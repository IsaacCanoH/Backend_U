/**
 * Decorator para agregar servicios adicionales al precio de una asignación
 * Implementa el patrón Decorator para cálculo dinámico de precios
 */
class ServicioDecorator {
  constructor(asignacionPrecio, servicio) {
    this.asignacionPrecio = asignacionPrecio;
    this.servicio = servicio;
    this.precioServicio = parseFloat(servicio.precio) || 0;
  }

  /**
   * Calcula el precio total incluyendo el servicio decorado
   * @returns {number} - Precio total con el servicio agregado
   */
  getPrecioTotal() {
    return this.asignacionPrecio.getPrecioTotal() + this.precioServicio;
  }

  /**
   * Obtiene la descripción detallada con todos los servicios
   * @returns {object} - Objeto con desglose completo de precios
   */
  getDescripcion() {
    const descripcionAnterior = this.asignacionPrecio.getDescripcion();

    // Agregar el servicio actual a la lista
    const serviciosActualizados = [
      ...descripcionAnterior.servicios,
      {
        id: this.servicio.id,
        nombre: this.servicio.nombre,
        precio: this.precioServicio,
        es_base: this.servicio.es_base
      }
    ];

    return {
      ...descripcionAnterior,
      servicios: serviciosActualizados,
      precio_total: this.getPrecioTotal()
    };
  }

  /**
   * Obtiene la instancia de la asignación original
   * @returns {object} - Objeto EstudianteUnidad de Sequelize
   */
  getAsignacion() {
    return this.asignacionPrecio.getAsignacion();
  }
}

export default ServicioDecorator;
