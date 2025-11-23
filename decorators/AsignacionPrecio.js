/**
 * Clase base para el cálculo de precios de una asignación estudiante-unidad
 * Representa el componente base en el patrón Decorator
 */
class AsignacionPrecio {
  constructor(estudianteUnidad, unidad) {
    this.estudianteUnidad = estudianteUnidad;
    this.unidad = unidad;
    this.precioBase = parseFloat(unidad.precio) || 0;
  }

  /**
   * Obtiene el precio total (solo precio base sin servicios)
   * @returns {number} - Precio base de la unidad
   */
  getPrecioTotal() {
    return this.precioBase;
  }

  /**
   * Obtiene la descripción detallada del precio
   * @returns {object} - Objeto con desglose de precios
   */
  getDescripcion() {
    return {
      estudiante_unidad_id: this.estudianteUnidad.id,
      unidad_id: this.unidad.id,
      nombre_unidad: this.unidad.nombre,
      precio_base: this.precioBase,
      servicios: [],
      precio_total: this.precioBase
    };
  }

  /**
   * Obtiene la instancia de la asignación original
   * @returns {object} - Objeto EstudianteUnidad de Sequelize
   */
  getAsignacion() {
    return this.estudianteUnidad;
  }
}

export default AsignacionPrecio;
