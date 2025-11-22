import fs from 'fs';
import path from 'path';

export const moverArchivo = (rutaOrigen, carpetaDestino) => {
  const nombreArchivo = path.basename(rutaOrigen);
  const rutaCompleta = path.join(process.cwd(), 'uploads', carpetaDestino);
  
  crearDirectorioSiNoExiste(rutaCompleta);
  
  const rutaDestino = path.join(rutaCompleta, nombreArchivo);
  fs.renameSync(rutaOrigen, rutaDestino);
  
  return rutaDestino;
};

export const limpiarArchivoTemporal = (rutaArchivo) => {
  try {
    if (rutaArchivo && fs.existsSync(rutaArchivo)) {
      fs.unlinkSync(rutaArchivo);
    }
  } catch (error) {
    // Ignorar errores de limpieza
  }
};

const crearDirectorioSiNoExiste = (ruta) => {
  if (!fs.existsSync(ruta)) {
    fs.mkdirSync(ruta, { recursive: true });
  }
};
