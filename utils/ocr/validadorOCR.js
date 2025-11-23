import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import { ErrorOCR } from "../errores/erroresDocumento.js";
import { UtilidadHash } from "./UtilidadHash.js";

/**
 * Clase responsable de extraer texto de imágenes mediante OCR
 * y calcular hash de archivos para identificación única
 */
export class ValidadorOCR {
  /**
   * @param {Object} config - Configuración del validador OCR
   * @param {number} config.intentosMaximos - Máximo de reintentos (default: 3)
   * @param {number} config.delayInicial - Delay inicial en ms (default: 1000)
   * @param {number} config.factorMultiplicador - Factor de backoff (default: 2)
   * @param {number} config.timeout - Timeout en ms (default: 30000)
   * @param {number} config.chunkSize - Tamaño de chunk para hash (default: 64KB)
   */
  constructor(config = {}) {
    this.configuracion = {
      intentosMaximos: config.intentosMaximos || 3,
      delayInicial: config.delayInicial || 1000,
      factorMultiplicador: config.factorMultiplicador || 2,
      timeout: config.timeout || 30000,
      chunkSize: config.chunkSize || 64 * 1024
    };
    
    this.apiKey = process.env.OCR;
    this.endpoint = "https://api.ocr.space/parse/image";
  }

  /**
   * Extrae texto de una imagen usando OCR.Space
   * @param {string} rutaArchivo - Ruta del archivo a procesar
   * @returns {Promise<string>} - Texto extraído del documento
   */
  async extraerTexto(rutaArchivo) {
    await this._validarExistenciaArchivo(rutaArchivo);
    
    let ultimoError;
    
    // Implementar reintentos con backoff exponencial
    for (let intento = 1; intento <= this.configuracion.intentosMaximos; intento++) {
      let datosFormulario;
      let archivoStream;
      
      try {
        const resultado = this._crearFormulario(rutaArchivo);
        datosFormulario = resultado.datosFormulario;
        archivoStream = resultado.archivoStream;
        
        const respuesta = await this._enviarSolicitudOCR(datosFormulario);
        this._validarRespuestaOCR(respuesta.data);
        
        const textoExtraido = respuesta.data.ParsedResults[0].ParsedText;
        this._validarTextoExtraido(textoExtraido);
        
        return textoExtraido;
        
      } catch (error) {
        ultimoError = error;
        
        // Si es un error de OCR específico (no recuperable), no reintentar
        if (error instanceof ErrorOCR && !this._esErrorRecuperable(error)) {
          throw error;
        }
        
        // Si no quedan más intentos, lanzar el error
        if (intento === this.configuracion.intentosMaximos) {
          break;
        }
        
        // Calcular delay con backoff exponencial
        const delay = this.configuracion.delayInicial * 
          Math.pow(this.configuracion.factorMultiplicador, intento - 1);
        
        await this._esperar(delay);
        
      } finally {
        // Cerrar el stream si existe
        if (archivoStream && typeof archivoStream.destroy === 'function') {
          archivoStream.destroy();
        }
      }
    }
    
    // Si llegamos aquí, todos los intentos fallaron
    throw this._procesarErrorFinal(ultimoError);
  }

  /**
   * Calcula el hash SHA256 del contenido de un archivo
   * @param {string} rutaArchivo - Ruta del archivo
   * @returns {Promise<string>} - Hash SHA256 en formato hexadecimal
   */
  async calcularHashArchivo(rutaArchivo) {
    return await UtilidadHash.calcularHashArchivo(rutaArchivo, {
      chunkSize: this.configuracion.chunkSize,
      async: true
    });
  }

  /**
   * Extrae texto y calcula hash en una sola operación
   * @param {string} rutaArchivo - Ruta del archivo
   * @returns {Promise<{texto: string, hash: string}>} - Texto y hash
   */
  async extraerTextoYHash(rutaArchivo) {
    const [texto, hash] = await Promise.all([
      this.extraerTexto(rutaArchivo),
      this.calcularHashArchivo(rutaArchivo)
    ]);
    
    return { texto, hash };
  }

  /**
   * Valida que el archivo existe y es accesible
   * @param {string} rutaArchivo - Ruta del archivo
   * @private
   */
  async _validarExistenciaArchivo(rutaArchivo) {
    try {
      await fs.promises.access(rutaArchivo, fs.constants.R_OK);
    } catch (error) {
      throw new ErrorOCR(
        `El archivo no existe o no es accesible: ${rutaArchivo}`,
        'ARCHIVO_NO_ENCONTRADO',
        { rutaArchivo }
      );
    }
  }

  /**
   * Determina si un error es recuperable y merece un reintento
   * @param {Error} error - Error a evaluar
   * @returns {boolean} - true si es recuperable
   * @private
   */
  _esErrorRecuperable(error) {
    if (!(error instanceof ErrorOCR)) {
      return true;
    }
    
    // Errores recuperables: timeout, conexión, respuesta API temporal
    const tiposRecuperables = ['TIMEOUT', 'CONEXION', 'RESPUESTA_API'];
    return tiposRecuperables.includes(error.tipo);
  }

  /**
   * Función auxiliar para esperar un tiempo determinado
   * @param {number} ms - Milisegundos a esperar
   * @returns {Promise<void>}
   * @private
   */
  _esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Crea el formulario con los datos del archivo
   * @param {string} rutaArchivo - Ruta del archivo
   * @returns {Object} - Objeto con datosFormulario y archivoStream
   * @private
   */
  _crearFormulario(rutaArchivo) {
    const datosFormulario = new FormData();
    
    const archivoStream = fs.createReadStream(rutaArchivo, {
      highWaterMark: 64 * 1024
    });
    
    datosFormulario.append("file", archivoStream);
    datosFormulario.append("language", "spa");
    datosFormulario.append("isOverlayRequired", "false");
    
    return { datosFormulario, archivoStream };
  }

  /**
   * Envía la solicitud a la API de OCR.Space
   * @param {FormData} datosFormulario - Datos del formulario
   * @returns {Promise<Object>} - Respuesta de Axios
   * @private
   */
  async _enviarSolicitudOCR(datosFormulario) {
    if (!this.apiKey) {
      throw new ErrorOCR(
        "Clave API de OCR no configurada en las variables de entorno",
        'CONFIGURACION'
      );
    }
    
    return await axios.post(
      this.endpoint,
      datosFormulario,
      {
        headers: {
          ...datosFormulario.getHeaders(),
          apikey: this.apiKey,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: this.configuracion.timeout,
        validateStatus: (status) => status < 500,
      }
    );
  }

  /**
   * Valida la respuesta de la API de OCR.Space
   * @param {Object} data - Datos de la respuesta
   * @private
   */
  _validarRespuestaOCR(data) {
    if (data.IsErroredOnProcessing) {
      throw new ErrorOCR(
        "Error al procesar el documento con OCR.Space",
        'PROCESAMIENTO_API',
        { resultado: data }
      );
    }
    
    if (!data.ParsedResults || data.ParsedResults.length === 0) {
      throw new ErrorOCR(
        "No se pudo extraer texto del documento",
        'SIN_RESULTADOS'
      );
    }
  }

  /**
   * Valida que el texto extraído no esté vacío
   * @param {string} texto - Texto extraído
   * @private
   */
  _validarTextoExtraido(texto) {
    if (!texto || texto.trim() === "") {
      throw new ErrorOCR(
        "El documento no contiene texto legible",
        'SIN_TEXTO'
      );
    }
  }

  /**
   * Procesa el error final después de agotar todos los intentos
   * @param {Error} error - Error original
   * @returns {ErrorOCR} - Error formateado
   * @private
   */
  _procesarErrorFinal(error) {
    if (error instanceof ErrorOCR) {
      return error;
    }
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return new ErrorOCR(
        `Tiempo de espera agotado al procesar el documento con OCR.Space después de ${this.configuracion.intentosMaximos} intentos`,
        'TIMEOUT',
        { code: error.code, intentos: this.configuracion.intentosMaximos }
      );
    }
    
    if (error.response) {
      return new ErrorOCR(
        `Error en OCR.Space: ${error.response.data?.ErrorMessage || error.message}`,
        'RESPUESTA_API',
        { status: error.response.status, data: error.response.data }
      );
    }
    
    return new ErrorOCR(
      error.message || "Error al conectar con OCR.Space",
      'CONEXION',
      { code: error.code }
    );
  }

  /**
   * Actualiza la configuración del validador
   * @param {Object} nuevaConfig - Nueva configuración
   */
  actualizarConfiguracion(nuevaConfig) {
    this.configuracion = { ...this.configuracion, ...nuevaConfig };
  }

  /**
   * Obtiene la configuración actual
   * @returns {Object} - Configuración actual
   */
  obtenerConfiguracion() {
    return { ...this.configuracion };
  }

  /**
   * Verifica si la API key está configurada
   * @returns {boolean}
   */
  estaConfigurado() {
    return !!this.apiKey;
  }

  /**
   * Obtiene información de estado del validador
   * @returns {Object}
   */
  obtenerEstado() {
    return {
      configurado: this.estaConfigurado(),
      endpoint: this.endpoint,
      configuracion: this.obtenerConfiguracion()
    };
  }
}
