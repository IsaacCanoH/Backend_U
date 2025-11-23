import { ValidadorOCR } from "./validadorOCR.js";
import { ServicioValidadorDocumento } from "./servicioValidadorDocumento.js";
import { ManejadorCache } from "./manejadorCache.js";
import { ErrorDocumento } from "../errores/erroresDocumento.js";

/**
 * Proxy optimizado para validación de documentos con caché integrada
 * Enfocado en velocidad máxima para documentos cacheados
 */
export class ProxyValidadorDocumento {
  /**
   * @param {Object} config - Configuración del proxy
   * @param {ValidadorOCR} config.validadorOCR - Instancia del validador OCR (opcional)
   * @param {ServicioValidadorDocumento} config.servicioValidador - Instancia del servicio validador (opcional)
   * @param {ManejadorCache} config.manejadorCache - Instancia del manejador de caché (opcional)
   * @param {Object} config.configOCR - Configuración para OCR
   * @param {Object} config.configServicio - Configuración para servicio
   * @param {Object} config.configCache - Configuración para caché
   */
  constructor(config = {}) {
    // Inicializar componentes con configuración por defecto o personalizada
    this.validadorOCR = config.validadorOCR || new ValidadorOCR(config.configOCR || {});
    this.servicioValidador = config.servicioValidador || 
      new ServicioValidadorDocumento(config.configServicio || {});
    this.manejadorCache = config.manejadorCache || 
      new ManejadorCache(config.configCache || {});
  }

  /**
   * Valida un documento completo (método principal)
   * Optimizado para velocidad máxima en cache hits
   * @param {string} rutaArchivo - Ruta del archivo a validar
   * @param {number} tipoId - ID del tipo de documento
   * @param {Object} opcionesValidacion - Opciones adicionales de validación
   * @returns {Promise<ResultadoValidacion>} - Resultado de la validación
   */
  async validarDocumento(rutaArchivo, tipoId, opcionesValidacion = {}) {
    try {
      // 1. Calcular hash del archivo
      const hash = await this.validadorOCR.calcularHashArchivo(rutaArchivo);
      
      // 2. Verificar caché - RETORNO RÁPIDO SI ESTÁ EN CACHE
      const resultadoCache = this.manejadorCache.obtener(hash);
      if (resultadoCache) {
        return resultadoCache;
      }
      
      // 3. Extraer texto mediante OCR (solo si no está en cache)
      const { texto } = await this.validadorOCR.extraerTextoYHash(rutaArchivo);
      
      // 4. Validar campos y lógica de negocio
      const resultado = await this.servicioValidador.validarCampos(
        texto, 
        tipoId, 
        opcionesValidacion
      );
      
      // 5. Asignar hash al resultado
      resultado.asignarHash(hash);
      
      // 6. Guardar en caché si aplica
      if (resultado.debeSerCacheado()) {
        this.manejadorCache.guardar(hash, resultado);
      }
      
      return resultado;
      
    } catch (error) {
      // Manejar errores específicos
      if (error.errorControlado) {
        throw error;
      }
      
      // Envolver errores no controlados
      throw new ErrorDocumento(`Error al validar el documento: ${error.message}`);
    }
  }

  /**
   * Valida múltiples documentos en lote
   * @param {Array} documentos - Array de documentos a validar
   * @param {Object} opciones - Opciones de procesamiento
   * @param {boolean} opciones.paralelo - Si procesar en paralelo (default: true)
   * @param {number} opciones.maxConcurrente - Máximo de procesos concurrentes
   * @returns {Promise<Array>} - Array de resultados
   */
  async validarLote(documentos, opciones = {}) {
    const { paralelo = true, maxConcurrente = 5 } = opciones;
    
    if (!Array.isArray(documentos) || documentos.length === 0) {
      throw new Error('Se requiere un array de documentos válido');
    }
    
    if (paralelo) {
      return await this._validarLoteParalelo(documentos, maxConcurrente);
    } else {
      return await this._validarLoteSecuencial(documentos);
    }
  }

  /**
   * Valida lote en paralelo con control de concurrencia
   * @param {Array} documentos - Documentos a validar
   * @param {number} maxConcurrente - Máximo concurrente
   * @returns {Promise<Array>}
   * @private
   */
  async _validarLoteParalelo(documentos, maxConcurrente) {
    const resultados = [];
    const chunks = this._dividirEnChunks(documentos, maxConcurrente);
    
    for (const chunk of chunks) {
      const promesas = chunk.map(async ({ rutaArchivo, tipoId, opciones }) => {
        try {
          return await this.validarDocumento(rutaArchivo, tipoId, opciones);
        } catch (error) {
          return { error: error.message, rutaArchivo };
        }
      });
      
      const resultadosChunk = await Promise.all(promesas);
      resultados.push(...resultadosChunk);
    }
    
    return resultados;
  }

  /**
   * Valida lote de forma secuencial
   * @param {Array} documentos - Documentos a validar
   * @returns {Promise<Array>}
   * @private
   */
  async _validarLoteSecuencial(documentos) {
    const resultados = [];
    
    for (const { rutaArchivo, tipoId, opciones } of documentos) {
      try {
        const resultado = await this.validarDocumento(rutaArchivo, tipoId, opciones);
        resultados.push(resultado);
      } catch (error) {
        resultados.push({ error: error.message, rutaArchivo });
      }
    }
    
    return resultados;
  }

  /**
   * Divide un array en chunks más pequeños
   * @param {Array} array - Array a dividir
   * @param {number} tamanoChunk - Tamaño de cada chunk
   * @returns {Array<Array>}
   * @private
   */
  _dividirEnChunks(array, tamanoChunk) {
    const chunks = [];
    for (let i = 0; i < array.length; i += tamanoChunk) {
      chunks.push(array.slice(i, i + tamanoChunk));
    }
    return chunks;
  }

  /**
   * Verifica si un archivo ya está en caché
   * @param {string} rutaArchivo - Ruta del archivo
   * @returns {Promise<boolean>}
   */
  async estaEnCache(rutaArchivo) {
    try {
      const hash = await this.validadorOCR.calcularHashArchivo(rutaArchivo);
      return this.manejadorCache.existe(hash);
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtiene un resultado cacheado sin procesar
   * @param {string} rutaArchivo - Ruta del archivo
   * @returns {Promise<ResultadoValidacion|null>}
   */
  async obtenerResultadoCacheado(rutaArchivo) {
    try {
      const hash = await this.validadorOCR.calcularHashArchivo(rutaArchivo);
      return this.manejadorCache.obtener(hash);
    } catch (error) {
      return null;
    }
  }

  /**
   * Limpia la caché completamente
   */
  limpiarCache() {
    this.manejadorCache.limpiarTodo();
  }

  /**
   * Elimina un resultado específico de la caché
   * @param {string} rutaArchivo - Ruta del archivo a eliminar
   * @returns {Promise<boolean>}
   */
  async eliminarDeCache(rutaArchivo) {
    try {
      const hash = await this.validadorOCR.calcularHashArchivo(rutaArchivo);
      return this.manejadorCache.eliminar(hash);
    } catch (error) {
      return false;
    }
  }


  /**
   * Actualiza la configuración de los componentes
   * @param {Object} config - Nueva configuración
   */
  actualizarConfiguracion(config) {
    if (config.ocr) {
      this.validadorOCR.actualizarConfiguracion(config.ocr);
    }
    
    if (config.servicio) {
      this.servicioValidador.actualizarConfiguracion(config.servicio);
    }
    
    if (config.cache) {
      this.manejadorCache.configurarTTL(config.cache);
    }
  }

  /**
   * Cierra y libera recursos
   */
  cerrar() {
    this.manejadorCache.cerrar();
  }


  /**
   * Exporta configuración actual
   * @returns {Object}
   */
  exportarConfiguracion() {
    return {
      ocr: this.validadorOCR.obtenerConfiguracion(),
      servicio: this.servicioValidador.obtenerConfiguracion(),
      cache: this.manejadorCache.obtenerConfiguracion()
    };
  }
}
