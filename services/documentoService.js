import Documento from '../models/documento.js';
import TipoDocumento from '../models/tipo_documento.js';


import validarDocumento from '../utils/ocr/validarDocumento.js';
import { moverArchivo, limpiarArchivoTemporal } from '../utils/files/manejadorArchivos.js';

export const procesarDocumento = async (rutaDocumento, tipo_id, opcionesValidacion = {}) => {
  try {
    console.log(`Procesando documento: ${rutaDocumento} con tipo: ${tipo_id}`);
    await validarDocumento(rutaDocumento, tipo_id, opcionesValidacion);

    console.log(`Documento validado exitosamente`);
    const carpetaDestino = obtenerCarpetaDestino(tipo_id);
    const rutaFinal = moverArchivo(rutaDocumento, carpetaDestino);
    console.log(`Documento movido a: ${rutaFinal}`);
    
    return { rutaFinal };
  } catch (error) {
    console.error(`Error procesando documento ${rutaDocumento}:`, error.message);
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

export const obtenerDocumentos = async () => {
  return await TipoDocumento.findAll();
};

export const obtenerTipoDocumentoPorID = async (id) => {
  return await TipoDocumento.findByPk(id);
};