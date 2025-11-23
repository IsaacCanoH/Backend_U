import Documento from '../models/documento.js';
import TipoDocumento from '../models/tipo_documento.js';

import { ProxyValidadorDocumento } from '../utils/ocr/proxyValidadorDocumento.js';
import { moverArchivo, limpiarArchivoTemporal } from '../utils/files/manejadorArchivos.js';

// Instancia global del proxy optimizada para velocidad - TTL UNIFICADO A 3 MINUTOS
const proxyValidador = new ProxyValidadorDocumento({
  configCache: {
    ttlInvalido: 180,  // 3 minutos unificado para documentos inválidos
    ttlParcial: 180,    // 3 minutos unificado para documentos parciales
    useClones: false,   // Máxima velocidad
    enableStats: false  // Sin estadísticas
  },
  configOCR: {
    intentosMaximos: 3,
    timeout: 30000
  },
  configServicio: {
    umbralSimilitudNombre: 0.9,
    umbralInvalido: 40,
    umbralParcial: 70
  }
});

export const procesarDocumento = async (rutaDocumento, tipo_id, opcionesValidacion = {}) => {
  try {
    // Usar el proxy optimizado para validación con caché
    const resultadoValidacion = await proxyValidador.validarDocumento(rutaDocumento, tipo_id, opcionesValidacion);
    
    // El resultado ya incluye el manejo de errores específicos
    if (!resultadoValidacion.esValido) {
      // Lanzar error con el mensaje específico del resultado
      const error = new Error(resultadoValidacion.generarMensaje());
      error.errorControlado = true;
      error.codigoEstado = 400;
      error.tipo = 'VALIDACION_DOCUMENTO';
      
      // Convertir tipoValidacion a subtipo esperado por el frontend
      switch (resultadoValidacion.tipoValidacion) {
        case 'NOMBRE_NO_COINCIDE':
          error.subtipo = 'nombre_no_coincide';
          break;
        case 'FALTAN_CAMPOS_AL_DOCUMENTO':
          error.subtipo = 'faltan_campos_al_documento';
          break;
        case 'DOCUMENTO_INVALIDO':
          error.subtipo = 'documento_invalido';
          break;
        default:
          error.subtipo = 'documento_invalido';
      }
      
      error.detalles = resultadoValidacion.detalles;
      throw error;
    }

    const carpetaDestino = obtenerCarpetaDestino(tipo_id);
    const rutaFinal = moverArchivo(rutaDocumento, carpetaDestino);
    
    return { 
      rutaFinal,
      validacion: resultadoValidacion.toPlainObject()
    };
  } catch (error) {
    limpiarArchivoTemporal(rutaDocumento);
    throw error;
  }
};

export const guardarDocumento = async (rutaFinal, tipo_id, renteroId = null, propiedadId = null, transaccion = null) => {
  const opciones = transaccion ? { transaction: transaccion } : {};
  
  return await Documento.create({
    ruta_archivo: rutaFinal,
    tipo_id,
    rentero_id: renteroId,
    propiedad_id: propiedadId
  }, opciones);
};

const obtenerCarpetaDestino = (tipo_id) => {
  const tipo = Number(tipo_id)
  
  if (tipo === 1) {
    return 'rentero/identidad';
  }
  
  return 'rentero/propiedad';
};

export const obtenerTipoDocumentoPorID = async (id) => {
  return await TipoDocumento.findByPk(id);
};

export const obtenerDocumentos = async () => {
  return await TipoDocumento.findAll();
};

/**
 * Verifica si un documento está en caché - OPERACIÓN CRÍTICA PARA VELOCIDAD
 * @param {string} rutaArchivo - Ruta del archivo
 * @returns {Promise<boolean>} - true si está en caché
 */
export const verificarCacheDocumento = async (rutaArchivo) => {
  return await proxyValidador.estaEnCache(rutaArchivo);
};

/**
 * Limpia la caché de validación
 */
export const limpiarCacheValidacion = () => {
  proxyValidador.limpiarCache();
};