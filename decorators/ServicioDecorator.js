/**
 * Decorator para agregar servicios adicionales al precio de una asignación
 * Implementa el patrón Decorator para cálculo dinámico de precios
 */
class ServicioDecorator {
  constructor(asignacionPrecio, servicio, through = {}) {
    this.asignacionPrecio = asignacionPrecio;
    this.servicio = servicio;
    this.through = through;
    this.precioServicio =
      parseFloat(this.through.precio_snapshot ?? this.servicio.precio) || 0;
  }

  /**
   * Calcula el precio total incluyendo el servicio decorado
   * @returns {number} - Precio total con el servicio agregado
   */
  getPrecioTotal() {
    try {
      if (this.servicio.es_base) {
        return this.asignacionPrecio.getPrecioTotal();
      }
      return this.asignacionPrecio.getPrecioTotal() + this.precioServicio;
    } catch (err) {
      console.error("ServicioDecorator.getPrecioTotal error:", err);
      throw err;
    }
  }

  /**
   * Obtiene la descripción detallada con todos los servicios
   * @returns {object} - Objeto con desglose completo de precios
   */
  getDescripcion() {
    try {
      const descripcionAnterior = this.asignacionPrecio.getDescripcion() || {};
      const serviciosPrev = Array.isArray(descripcionAnterior.servicios)
        ? descripcionAnterior.servicios
        : [];

      const serviciosActualizados = [
        ...serviciosPrev,
        {
          id: this.servicio.id,
          nombre: this.servicio.nombre,
          precio: this.servicio.es_base ? 0 : this.precioServicio,
          es_base: !!this.servicio.es_base,
          estado: this.through?.estado ?? null,
          fecha_inicio: this.through?.fecha_inicio ?? null,
          fecha_agregado: this.through?.fecha_agregado ?? null,
        },
      ];

      return {
        ...descripcionAnterior,
        servicios: serviciosActualizados,
        precio_total: this.getPrecioTotal(),
      };
    } catch (err) {
      console.error("ServicioDecorator.getDescripcion error:", err);
      throw err;
    }
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
