export class ErrorDocumento extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorDocumento';
    this.codigoEstado = 400;
    this.errorControlado = true;
    this.tipo = 'DOCUMENTO';
    this.timestamp = new Date().toISOString();
  }
}

export class ErrorOCR extends Error {
  constructor(mensaje, subtipo = 'GENERAL', detalles = null) {
    super(mensaje);
    this.name = 'ErrorOCR';
    this.codigoEstado = 500;
    this.errorControlado = true;
    this.tipo = 'OCR';
    this.subtipo = subtipo;
    this.detalles = detalles;
    this.timestamp = new Date().toISOString();
  }
}

export class ErrorValidacionDocumento extends Error {
  constructor(mensaje, subtipo = 'GENERAL', detalles = null, faltantesConteo = null, totalRequeridos = null) {
    super(mensaje);
    this.name = 'ErrorValidacionDocumento';
    this.codigoEstado = 400;
    this.errorControlado = true;
    this.tipo = 'VALIDACION_DOCUMENTO';
    this.subtipo = subtipo;
    this.detalles = detalles;
    this.faltantesConteo = faltantesConteo;
    this.totalRequeridos = totalRequeridos;
    this.timestamp = new Date().toISOString();
  }
}

export class ErrorBaseDatos extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorBaseDatos';
    this.codigoEstado = 500;
    this.errorControlado = true;
    this.tipo = 'BASE_DATOS';
    this.timestamp = new Date().toISOString();
  }
}

export class ErrorArchivoDocumento extends Error {
  constructor(mensaje, codigoMulter) {
    super(mensaje);
    this.name = 'ErrorArchivoDocumento';
    this.codigoEstado = 400;
    this.errorControlado = true;
    this.tipo = 'ARCHIVO';
    this.codigoMulter = codigoMulter;
    this.timestamp = new Date().toISOString();
  }
}

const obtenerMensajeMulter = (codigo) => {
  const mensajes = {
    'LIMIT_FILE_SIZE': 'El archivo excede el tamaño máximo permitido',
    'LIMIT_FILE_COUNT': 'Se excedió el número de archivos permitidos',
    'LIMIT_UNEXPECTED_FILE': 'Campo de archivo inesperado'
  };
  return mensajes[codigo] || 'Error al cargar el archivo';
};

export { obtenerMensajeMulter };