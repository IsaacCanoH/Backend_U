import crypto from 'crypto';
import fs from 'fs';

/**
 * Utilidad para calcular hash SHA256 del contenido de archivos
 * Permite identificar archivos idénticos independientemente de su nombre
 */
export class UtilidadHash {
  /**
   * Calcula el hash SHA256 del contenido de un archivo
   * @param {string} rutaArchivo - Ruta absoluta del archivo
   * @param {Object} opciones - Opciones de configuración
   * @param {number} opciones.chunkSize - Tamaño del chunk para lectura (default: 64KB)
   * @param {boolean} opciones.async - Si debe usar lectura asíncrona (default: true)
   * @returns {Promise<string>} - Hash SHA256 en formato hexadecimal
   */
  static async calcularHashArchivo(rutaArchivo, opciones = {}) {
    const { chunkSize = 64 * 1024, async = true } = opciones;

    // Validar que el archivo existe
    await UtilidadHash._validarArchivo(rutaArchivo);

    if (async) {
      return await UtilidadHash._calcularHashAsync(rutaArchivo, chunkSize);
    } else {
      return UtilidadHash._calcularHashSync(rutaArchivo, chunkSize);
    }
  }

  /**
   * Calcula hash usando streams asíncronos (recomendado para archivos grandes)
   * @param {string} rutaArchivo - Ruta del archivo
   * @param {number} chunkSize - Tamaño del chunk
   * @returns {Promise<string>}
   * @private
   */
  static async _calcularHashAsync(rutaArchivo, chunkSize) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(rutaArchivo, { 
        highWaterMark: chunkSize 
      });

      stream.on('data', (chunk) => {
        hash.update(chunk);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', (error) => {
        reject(new Error(`Error leyendo archivo ${rutaArchivo}: ${error.message}`));
      });
    });
  }

  /**
   * Calcula hash usando lectura síncrona (para archivos pequeños)
   * @param {string} rutaArchivo - Ruta del archivo
   * @param {number} chunkSize - Tamaño del chunk
   * @returns {string}
   * @private
   */
  static _calcularHashSync(rutaArchivo, chunkSize) {
    const hash = crypto.createHash('sha256');
    const fd = fs.openSync(rutaArchivo, 'r');
    
    try {
      const buffer = Buffer.allocUnsafe(chunkSize);
      let bytesRead;
      
      while ((bytesRead = fs.readSync(fd, buffer, 0, chunkSize, null)) > 0) {
        hash.update(buffer.slice(0, bytesRead));
      }
      
      return hash.digest('hex');
    } finally {
      fs.closeSync(fd);
    }
  }

  /**
   * Valida que el archivo existe y es accesible
   * @param {string} rutaArchivo - Ruta del archivo
   * @private
   */
  static async _validarArchivo(rutaArchivo) {
    if (!rutaArchivo || typeof rutaArchivo !== 'string') {
      throw new Error('Ruta de archivo inválida');
    }

    try {
      await fs.promises.access(rutaArchivo, fs.constants.R_OK);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`El archivo no existe: ${rutaArchivo}`);
      } else if (error.code === 'EACCES') {
        throw new Error(`Sin permisos para leer el archivo: ${rutaArchivo}`);
      } else {
        throw new Error(`Error accediendo al archivo ${rutaArchivo}: ${error.message}`);
      }
    }
  }

  /**
   * Calcula hash de un buffer en memoria
   * @param {Buffer} buffer - Buffer de datos
   * @returns {string} - Hash SHA256 en hexadecimal
   */
  static calcularHashBuffer(buffer) {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Se requiere un Buffer válido');
    }

    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Calcula hash de una cadena de texto
   * @param {string} texto - Texto a hashear
   * @param {string} encoding - Codificación del texto (default: 'utf8')
   * @returns {string} - Hash SHA256 en hexadecimal
   */
  static calcularHashTexto(texto, encoding = 'utf8') {
    if (typeof texto !== 'string') {
      throw new Error('Se requiere una cadena de texto válida');
    }

    return crypto.createHash('sha256').update(texto, encoding).digest('hex');
  }

  /**
   * Compara dos archivos por su hash
   * @param {string} rutaArchivo1 - Ruta del primer archivo
   * @param {string} rutaArchivo2 - Ruta del segundo archivo
   * @param {Object} opciones - Opciones de configuración
   * @returns {Promise<boolean>} - true si son idénticos
   */
  static async compararArchivos(rutaArchivo1, rutaArchivo2, opciones = {}) {
    try {
      const [hash1, hash2] = await Promise.all([
        UtilidadHash.calcularHashArchivo(rutaArchivo1, opciones),
        UtilidadHash.calcularHashArchivo(rutaArchivo2, opciones)
      ]);

      return hash1 === hash2;
    } catch (error) {
      throw new Error(`Error comparando archivos: ${error.message}`);
    }
  }

  /**
   * Obtiene información del archivo junto con su hash
   * @param {string} rutaArchivo - Ruta del archivo
   * @param {Object} opciones - Opciones de configuración
   * @returns {Promise<Object>} - Información del archivo con hash
   */
  static async obtenerInfoConHash(rutaArchivo, opciones = {}) {
    const hash = await UtilidadHash.calcularHashArchivo(rutaArchivo, opciones);
    const stats = await fs.promises.stat(rutaArchivo);

    return {
      ruta: rutaArchivo,
      hash,
      tamano: stats.size,
      fechaModificacion: stats.mtime,
      fechaCreacion: stats.birthtime || stats.ctime,
      esDirectorio: stats.isDirectory(),
      esArchivo: stats.isFile()
    };
  }

  /**
   * Genera un hash corto (primeros 8 caracteres) para uso en logs
   * @param {string} rutaArchivo - Ruta del archivo
   * @returns {Promise<string>} - Hash corto
   */
  static async calcularHashCorto(rutaArchivo) {
    const hashCompleto = await UtilidadHash.calcularHashArchivo(rutaArchivo);
    return hashCompleto.substring(0, 8);
  }

  /**
   * Verifica la integridad de un archivo comparando con un hash conocido
   * @param {string} rutaArchivo - Ruta del archivo
   * @param {string} hashEsperado - Hash esperado
   * @param {Object} opciones - Opciones de configuración
   * @returns {Promise<boolean>} - true si el hash coincide
   */
  static async verificarIntegridad(rutaArchivo, hashEsperado, opciones = {}) {
    if (!hashEsperado || typeof hashEsperado !== 'string') {
      throw new Error('Hash esperado inválido');
    }

    const hashActual = await UtilidadHash.calcularHashArchivo(rutaArchivo, opciones);
    return hashActual.toLowerCase() === hashEsperado.toLowerCase();
  }

  /**
   * Limpia un hash removiendo caracteres no válidos (para uso en nombres de archivo)
   * @param {string} hash - Hash a limpiar
   * @returns {string} - Hash limpio
   */
  static limpiarHash(hash) {
    if (!hash || typeof hash !== 'string') {
      return '';
    }

    // Mantener solo caracteres hexadecimales
    return hash.replace(/[^a-fA-F0-9]/g, '');
  }
}
