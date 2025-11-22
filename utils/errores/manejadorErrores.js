import { ErrorArchivoDocumento, obtenerMensajeMulter } from './erroresDocumento.js';

export const manejadorErrores = (err, req, res, next) => {
  if (err.errorControlado) {
    return res.status(err.codigoEstado).json({
      estado: "error",
      mensaje: err.message,
      tipo: err.tipo || 'ERROR_APLICACION',
      ...(err.subtipo ? { subtipo: err.subtipo } : {}),
      ...(err.detalles ? { detalles: err.detalles } : {}),
      ...(typeof err.faltantesConteo === 'number' ? { faltantesConteo: err.faltantesConteo } : {}),
      ...(typeof err.totalRequeridos === 'number' ? { totalRequeridos: err.totalRequeridos } : {})
    });
  }

  // Error de Multer (archivo muy grande, etc.)
  if (err.name === 'MulterError') {
    const mensaje = obtenerMensajeMulter(err.code);
    const errorArchivo = new ErrorArchivoDocumento(mensaje, err.code);
    return res.status(errorArchivo.codigoEstado).json({
      estado: "error",
      mensaje: errorArchivo.message,
      tipo: errorArchivo.tipo
    });
  }

  return res.status(500).json({
    estado: "error",
    mensaje: "Error interno del servidor"
  });
};
