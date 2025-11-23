/**
 * Clase que encapsula el resultado de una validación de documento
 * con metadatos y detalles del proceso
 */
export class ResultadoValidacion {
  /**
   * @param {boolean} esValido - Indica si el documento es válido
   * @param {number} porcentaje - Porcentaje de campos reconocidos (0-100)
   * @param {string} tipoValidacion - Tipo de resultado: 'VALIDO', 'PARCIAL', 'INVALIDO'
   * @param {Object} detalles - Detalles adicionales de la validación
   * @param {string[]} detalles.camposFaltantes - Campos que no se encontraron
   * @param {number} detalles.camposTotales - Total de campos requeridos
   * @param {number} detalles.camposPresentes - Campos encontrados
   * @param {Object} detalles.similitudNombre - Información de similitud de nombre (opcional)
   */
  constructor(esValido, porcentaje, tipoValidacion, detalles = {}) {
    this.esValido = esValido;
    this.porcentaje = Math.round(porcentaje * 100) / 100; // Redondear a 2 decimales
    this.tipoValidacion = tipoValidacion;
    this.detalles = detalles;
    this.timestamp = new Date();
    this.hash = null; // Se asignará cuando se genere el hash del archivo
  }

  /**
   * Determina el tipo de validación basado en el porcentaje
   * @param {number} porcentaje - Porcentaje de reconocimiento
   * @returns {string} - Tipo de validación
   */
  static determinarTipoValidacion(porcentaje) {
    if (porcentaje < 40) return 'INVALIDO';
    if (porcentaje < 70) return 'PARCIAL';
    return 'VALIDO';
  }

  /**
   * Crea un resultado de validación inválido
   * @param {number} porcentaje - Porcentaje de reconocimiento
   * @param {string[]} camposFaltantes - Campos no encontrados
   * @param {number} camposTotales - Total de campos requeridos
   * @returns {ResultadoValidacion}
   */
  static crearInvalido(porcentaje, camposFaltantes, camposTotales) {
    return new ResultadoValidacion(
      false,
      porcentaje,
      'INVALIDO',
      {
        camposFaltantes,
        camposTotales,
        camposPresentes: camposTotales - camposFaltantes.length
      }
    );
  }

  /**
   * Crea un resultado de validación parcial
   * @param {number} porcentaje - Porcentaje de reconocimiento
   * @param {string[]} camposFaltantes - Campos no encontrados
   * @param {number} camposTotales - Total de campos requeridos
   * @returns {ResultadoValidacion}
   */
  static crearParcial(porcentaje, camposFaltantes, camposTotales) {
    return new ResultadoValidacion(
      false,
      porcentaje,
      'PARCIAL',
      {
        camposFaltantes,
        camposTotales,
        camposPresentes: camposTotales - camposFaltantes.length
      }
    );
  }

  /**
   * Crea un resultado de validación válido
   * @param {number} porcentaje - Porcentaje de reconocimiento
   * @param {number} camposTotales - Total de campos requeridos
   * @returns {ResultadoValidacion}
   */
  static crearValido(porcentaje, camposTotales) {
    return new ResultadoValidacion(
      true,
      porcentaje,
      'VALIDO',
      {
        camposFaltantes: [],
        camposTotales,
        camposPresentes: camposTotales
      }
    );
  }

  /**
   * Crea un resultado de validación por nombre no coincidente
   * @param {number} porcentaje - Porcentaje de reconocimiento
   * @param {number} similitud - Porcentaje de similitud del nombre
   * @param {string} nombreFormulario - Nombre del formulario
   * @param {number} camposTotales - Total de campos requeridos
   * @param {string[]} camposFaltantes - Campos no encontrados (si hay)
   * @returns {ResultadoValidacion}
   */
  static crearNombreNoCoincide(porcentaje, similitud, nombreFormulario, camposTotales, camposFaltantes = []) {
    return new ResultadoValidacion(
      false,
      porcentaje,
      'NOMBRE_NO_COINCIDE',
      {
        camposFaltantes,
        camposTotales,
        camposPresentes: camposTotales - camposFaltantes.length,
        similitudNombre: {
          similitud,
          nombreFormulario,
          umbral: 0.9
        }
      }
    );
  }

  /**
   * Asigna el hash del archivo al resultado
   * @param {string} hash - Hash SHA256 del archivo
   * @returns {ResultadoValidacion}
   */
  asignarHash(hash) {
    this.hash = hash;
    return this;
  }

  /**
   * Convierte el resultado a un objeto plano para serialización
   * @returns {Object}
   */
  toPlainObject() {
    return {
      esValido: this.esValido,
      porcentaje: this.porcentaje,
      tipoValidacion: this.tipoValidacion,
      detalles: this.detalles,
      timestamp: this.timestamp,
      hash: this.hash
    };
  }

  /**
   * Verifica si el resultado debe ser cacheado
   * @returns {boolean}
   */
  debeSerCacheado() {
    return this.tipoValidacion === 'INVALIDO' || this.tipoValidacion === 'PARCIAL';
  }

  /**
   * Obtiene el TTL en segundos - UNIFICADO A 3 MINUTOS PARA TODOS
   * @returns {number}
   */
  obtenerTTL() {
    switch (this.tipoValidacion) {
      case 'INVALIDO':
        return 180; // 3 minutos unificado
      case 'PARCIAL':
        return 180; // 3 minutos unificado
      default:
        return 0; // No cachear
    }
  }

  /**
   * Genera un mensaje descriptivo del resultado - FORMATO EXACTO DEL BACKEND ORIGINAL
   * @returns {string}
   */
  generarMensaje() {
    const { camposFaltantes, camposTotales } = this.detalles;
    
    switch (this.tipoValidacion) {
      case 'INVALIDO':
        return `DOCUMENTO_INVALIDO: Faltan ${camposFaltantes.length} campo(s): ${camposFaltantes.join(', ')}`;
      
      case 'PARCIAL':
        return `FALTAN_CAMPOS_AL_DOCUMENTO: Faltan ${camposFaltantes.length} campo(s): ${camposFaltantes.join(', ')}`;
      
      case 'NOMBRE_NO_COINCIDE':
        const { similitud, nombreFormulario } = this.detalles.similitudNombre;
        return `NOMBRE_NO_COINCIDE: El nombre del documento no coincide con el documento (similitud ${Math.round(similitud * 100)}%)`;
      
      case 'VALIDO':
        return `Documento válido (${this.porcentaje}% de campos reconocidos)`;
      
      default:
        return `Resultado de validación: ${this.tipoValidacion}`;
    }
  }
}
