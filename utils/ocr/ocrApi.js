import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import { ErrorOCR } from "../errores/erroresDocumento.js";

// Configuración de reintentos
const CONFIGURACION_REINTENTOS = {
  intentosMaximos: 3,
  delayInicial: 1000, // 1 segundo
  factorMultiplicador: 2,
  timeout: 30000 // 30 segundos 
};

/**
 * Función principal para extraer texto de imágenes usando OCR.Space
 * @param {string} rutaArchivo - Ruta del archivo a procesar
 * @returns {Promise<string>} - Texto extraído del documento
 */
const ocrApi = async (rutaArchivo) => {
  // Validar que el archivo existe antes de procesarlo
  await validarExistenciaArchivo(rutaArchivo);

  let ultimoError;

  // Implementar reintentos con backoff exponencial
  for (let intento = 1; intento <= CONFIGURACION_REINTENTOS.intentosMaximos; intento++) {
    let datosFormulario;
    let archivoStream;

    try {
      const resultado = crearFormulario(rutaArchivo);
      datosFormulario = resultado.datosFormulario;
      archivoStream = resultado.archivoStream;

      const respuesta = await enviarSolicitudOCR(datosFormulario);

      validarRespuestaOCR(respuesta.data);

      const textoExtraido = respuesta.data.ParsedResults[0].ParsedText;
      validarTextoExtraido(textoExtraido);

      return textoExtraido;

    } catch (error) {
      ultimoError = error;

      // Si es un error de OCR específico (no de timeout/red), no reintentar
      if (error instanceof ErrorOCR && !esErrorRecuperable(error)) {
        throw error;
      }

      // Si no quedan más intentos, lanzar el error
      if (intento === CONFIGURACION_REINTENTOS.intentosMaximos) {
        break;
      }

      // Calcular delay con backoff exponencial
      const delay = CONFIGURACION_REINTENTOS.delayInicial *
        Math.pow(CONFIGURACION_REINTENTOS.factorMultiplicador, intento - 1);

      await esperar(delay);

    } finally {
      // Cerrar el stream si existe
      if (archivoStream && typeof archivoStream.destroy === 'function') {
        archivoStream.destroy();
      }
    }
  }

  // Si llegamos aquí, todos los intentos fallaron
  throw procesarErrorFinal(ultimoError);
};

/**
 * Valida que el archivo existe y es accesible
 * @param {string} rutaArchivo - Ruta del archivo
 */
const validarExistenciaArchivo = async (rutaArchivo) => {
  try {
    await fs.promises.access(rutaArchivo, fs.constants.R_OK);
  } catch (error) {
    throw new ErrorOCR(
      `El archivo no existe o no es accesible: ${rutaArchivo}`,
      'ARCHIVO_NO_ENCONTRADO',
      { rutaArchivo }
    );
  }
};

/**
 * Determina si un error es recuperable y merece un reintento
 * @param {Error} error - Error a evaluar
 * @returns {boolean} - true si es recuperable
 */
const esErrorRecuperable = (error) => {
  if (!(error instanceof ErrorOCR)) {
    return true;
  }

  // Errores recuperables: timeout, conexión, respuesta API temporal
  const tiposRecuperables = ['TIMEOUT', 'CONEXION', 'RESPUESTA_API'];
  return tiposRecuperables.includes(error.tipo);
};

/**
 * Función auxiliar para esperar un tiempo determinado
 * @param {number} ms - Milisegundos a esperar
 * @returns {Promise<void>}
 */
const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Crea el formulario con los datos del archivo
 * @param {string} rutaArchivo - Ruta del archivo
 * @returns {Object} - Objeto con datosFormulario y archivoStream
 */
const crearFormulario = (rutaArchivo) => {
  const datosFormulario = new FormData();

  const archivoStream = fs.createReadStream(rutaArchivo, {
    highWaterMark: 64 * 1024
  });

  datosFormulario.append("file", archivoStream);
  datosFormulario.append("language", "spa");
  datosFormulario.append("isOverlayRequired", "false");

  return { datosFormulario, archivoStream };
};

/**
 * Envía la solicitud a la API de OCR.Space
 * @param {FormData} datosFormulario - Datos del formulario
 * @returns {Promise<Object>} - Respuesta de Axios
 */
const enviarSolicitudOCR = async (datosFormulario) => {
  // Validar que existe la clave API de OCR
  if (!process.env.OCR) {
    throw new ErrorOCR(
      "Clave API de OCR no configurada en las variables de entorno",
      'CONFIGURACION'
    );
  }

  return await axios.post(
    "https://api.ocr.space/parse/image",
    datosFormulario,
    {
      headers: {
        ...datosFormulario.getHeaders(),
        apikey: process.env.OCR,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: CONFIGURACION_REINTENTOS.timeout,
      // Agregar validación de estado de respuesta
      validateStatus: (status) => status < 500, // Aceptar códigos < 500 para manejarlos manualmente
    }
  );
};

/**
 * Valida la respuesta de la API de OCR.Space
 * @param {Object} data - Datos de la respuesta
 */
const validarRespuestaOCR = (data) => {
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
};

/**
 * Valida que el texto extraído no esté vacío
 * @param {string} texto - Texto extraído
 */
const validarTextoExtraido = (texto) => {
  if (!texto || texto.trim() === "") {
    throw new ErrorOCR(
      "El documento no contiene texto legible",
      'SIN_TEXTO'
    );
  }
};

/**
 * Procesa el error final después de agotar todos los intentos
 * @param {Error} error - Error original
 * @returns {ErrorOCR} - Error formateado
 */
const procesarErrorFinal = (error) => {
  if (error instanceof ErrorOCR) {
    return error;
  }

  if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
    return new ErrorOCR(
      `Tiempo de espera agotado al procesar el documento con OCR.Space después de ${CONFIGURACION_REINTENTOS.intentosMaximos} intentos`,
      'TIMEOUT',
      { code: error.code, intentos: CONFIGURACION_REINTENTOS.intentosMaximos }
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
};

export default ocrApi;