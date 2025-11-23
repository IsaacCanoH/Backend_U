import EstudianteUnidad from '../models/estudiante_unidad.js';
import Unidad from '../models/unidad.js';
import Servicio from '../models/servicio.js';
import EstudianteUnidadServicio from '../models/estudiante_unidad_servicio.js';
import AsignacionPrecio from '../decorators/AsignacionPrecio.js';
import ServicioDecorator from '../decorators/ServicioDecorator.js';

/**
 * Servicio para gestionar servicios personalizados de estudiantes
 * Implementa el patrón Decorator para cálculo dinámico de precios por asignación
 */
class ServiciosService {
  /**
   * Obtiene todos los servicios disponibles (activos)
   * @param {boolean} soloAdicionales - Si true, retorna solo servicios no base (es_base = false)
   * @returns {Promise<Array>} - Array de servicios
   */
  async obtenerServiciosDisponibles(soloAdicionales = false) {
    const where = { activo: true };

    if (soloAdicionales) {
      where.es_base = false;
    }

    return await Servicio.findAll({
      where,
      order: [['es_base', 'DESC'], ['nombre', 'ASC']]
    });
  }

  /**
   * Obtiene los servicios base (agua, luz, internet)
   * @returns {Promise<Array>} - Array de servicios base
   */
  async obtenerServiciosBase() {
    return await Servicio.findAll({
      where: {
        es_base: true,
        activo: true
      }
    });
  }

  /**
   * Calcula el precio total de una asignación con sus servicios usando Decorator Pattern
   * @param {number} estudianteUnidadId - ID de la asignación estudiante-unidad
   * @returns {Promise<object>} - Objeto con desglose detallado del precio
   */
  async calcularPrecioConServicios(estudianteUnidadId) {
    // Obtener la asignación con la unidad y sus servicios
    const estudianteUnidad = await EstudianteUnidad.findByPk(estudianteUnidadId, {
      include: [
        {
          model: Unidad,
          as: 'unidad',
          required: true
        },
        {
          model: Servicio,
          as: 'servicios',
          through: { attributes: ['fecha_agregado'] }
        }
      ]
    });

    if (!estudianteUnidad) {
      throw new Error('Asignación no encontrada');
    }

    if (!estudianteUnidad.unidad) {
      throw new Error('Unidad asociada no encontrada');
    }

    // Crear el componente base con la asignación y la unidad
    let asignacionConPrecio = new AsignacionPrecio(estudianteUnidad, estudianteUnidad.unidad);

    // Aplicar decoradores para cada servicio que el estudiante eligió
    if (estudianteUnidad.servicios && estudianteUnidad.servicios.length > 0) {
      for (const servicio of estudianteUnidad.servicios) {
        asignacionConPrecio = new ServicioDecorator(asignacionConPrecio, servicio);
      }
    }

    // Obtener la descripción detallada
    return asignacionConPrecio.getDescripcion();
  }

  /**
   * Agrega un servicio a la asignación de un estudiante
   * @param {number} estudianteUnidadId - ID de la asignación
   * @param {number} servicioId - ID del servicio
   * @returns {Promise<object>} - Resultado de la operación
   */
  async agregarServicioAAsignacion(estudianteUnidadId, servicioId) {
    // Validar que la asignación existe
    const estudianteUnidad = await EstudianteUnidad.findByPk(estudianteUnidadId);
    if (!estudianteUnidad) {
      throw new Error('Asignación no encontrada');
    }

    // Validar que el servicio existe y está activo
    const servicio = await Servicio.findOne({
      where: {
        id: servicioId,
        activo: true
      }
    });

    if (!servicio) {
      throw new Error('Servicio no encontrado o inactivo');
    }

    // VALIDACIÓN: No permitir agregar servicios base manualmente
    if (servicio.es_base) {
      throw new Error('Los servicios base se agregan automáticamente al rentar');
    }

    // Verificar si ya existe la relación
    const relacionExistente = await EstudianteUnidadServicio.findOne({
      where: {
        estudiante_unidad_id: estudianteUnidadId,
        servicio_id: servicioId
      }
    });

    if (relacionExistente) {
      throw new Error('El servicio ya está agregado a esta asignación');
    }

    // Crear la relación
    await EstudianteUnidadServicio.create({
      estudiante_unidad_id: estudianteUnidadId,
      servicio_id: servicioId
    });

    // Retornar el cálculo actualizado
    return await this.calcularPrecioConServicios(estudianteUnidadId);
  }

  /**
   * Elimina un servicio de la asignación de un estudiante
   * @param {number} estudianteUnidadId - ID de la asignación
   * @param {number} servicioId - ID del servicio
   * @returns {Promise<object>} - Resultado de la operación
   */
  async eliminarServicioDeAsignacion(estudianteUnidadId, servicioId) {
    // VALIDACIÓN: No permitir eliminar servicios base
    const servicio = await Servicio.findByPk(servicioId);
    if (servicio && servicio.es_base) {
      throw new Error('No puedes eliminar servicios base');
    }

    const resultado = await EstudianteUnidadServicio.destroy({
      where: {
        estudiante_unidad_id: estudianteUnidadId,
        servicio_id: servicioId
      }
    });

    if (resultado === 0) {
      throw new Error('El servicio no está asociado a esta asignación');
    }

    // Retornar el cálculo actualizado
    return await this.calcularPrecioConServicios(estudianteUnidadId);
  }

  /**
   * Obtiene los servicios de una asignación específica
   * @param {number} estudianteUnidadId - ID de la asignación
   * @returns {Promise<Array>} - Array de servicios asociados
   */
  async obtenerServiciosPorAsignacion(estudianteUnidadId) {
    const estudianteUnidad = await EstudianteUnidad.findByPk(estudianteUnidadId, {
      include: [{
        model: Servicio,
        as: 'servicios',
        through: { attributes: ['fecha_agregado'] }
      }]
    });

    if (!estudianteUnidad) {
      throw new Error('Asignación no encontrada');
    }

    return estudianteUnidad.servicios || [];
  }

  /**
   * Agrega servicios base automáticamente cuando un estudiante renta una unidad
   * @param {number} estudianteUnidadId - ID de la asignación recién creada
   * @param {Object} transaction - Transacción de Sequelize (opcional)
   * @returns {Promise<void>}
   */
  async agregarServiciosBaseAAsignacion(estudianteUnidadId, transaction = null) {
    const serviciosBase = await this.obtenerServiciosBase();

    const options = transaction ? { transaction } : {};

    for (const servicio of serviciosBase) {
      await EstudianteUnidadServicio.create({
        estudiante_unidad_id: estudianteUnidadId,
        servicio_id: servicio.id
      }, options);
    }
  }
}

export default new ServiciosService();
