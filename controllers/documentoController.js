import * as documentoService from "../services/documentoService.js";

export const obtenerDocumentos = async (req, res, next) => {
  try {
    const documentos = await documentoService.obtenerDocumentos();
    
    res.status(200).json(documentos);
  } catch (error) {
    next(error);
  }
};