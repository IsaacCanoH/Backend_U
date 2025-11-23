import EstudianteUnidad from "../models/estudiante_unidad.js";
import Unidad from "../models/unidad.js";
import Servicio from "../models/servicio.js";
import EstudianteUnidadServicio from "../models/estudiante_unidad_servicio.js";
import AsignacionPrecio from "../decorators/AsignacionPrecio.js";
import ServicioDecorator from "../decorators/ServicioDecorator.js";

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
      order: [
        ["es_base", "DESC"],
        ["nombre", "ASC"],
      ],
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
        activo: true,
      },
    });
  }

  /**
   * Calcula el precio total de una asignación con sus servicios usando Decorator Pattern
   * @param {number} estudianteUnidadId - ID de la asignación estudiante-unidad
   * @returns {Promise<object>} - Objeto con desglose detallado del precio
   */
  async calcularPrecioConServicios(estudianteUnidadId) {
    const estudianteUnidad = await EstudianteUnidad.findByPk(
      estudianteUnidadId,
      {
        include: [
          { model: Unidad, as: "unidad", required: true },
          {
            model: Servicio,
            as: "servicios",
            through: {
              attributes: [
                "fecha_agregado",
                "precio_snapshot",
                "estado",
                "fecha_inicio",
                "fecha_fin",
              ],
            },
          },
        ],
      }
    );

    if (!estudianteUnidad) throw new Error("Asignación no encontrada");
    if (!estudianteUnidad.unidad)
      throw new Error("Unidad asociada no encontrada");

    const now = new Date();
    // sólo servicios cuya relación está "activo" y cuya fecha_inicio <= now y (fecha_fin nula o > now)
    const serviciosActivos = (estudianteUnidad.servicios || []).filter(
      (srv) => {
        const link = srv.estudiante_unidad_servicio || {};
        const estado = link.estado || "activo";
        const fi = link.fecha_inicio
          ? new Date(link.fecha_inicio)
          : new Date(0);
        const ff = link.fecha_fin ? new Date(link.fecha_fin) : null;
        return estado === "activo" && fi <= now && (!ff || ff > now);
      }
    );

    let asignacionConPrecio = new AsignacionPrecio(
      estudianteUnidad,
      estudianteUnidad.unidad
    );

    for (const servicio of serviciosActivos) {
      asignacionConPrecio = new ServicioDecorator(
        asignacionConPrecio,
        servicio,
        servicio.estudiante_unidad_servicio
      );
    }

    return asignacionConPrecio.getDescripcion();
  }

  /**
   * Agrega un servicio a la asignación de un estudiante
   * @param {number} estudianteUnidadId - ID de la asignación
   * @param {number} servicioId - ID del servicio
   * @returns {Promise<object>} - Resultado de la operación
   */
  async agregarServicioAAsignacion(estudianteUnidadId, servicioId) {
    const estudianteUnidad = await EstudianteUnidad.findByPk(
      estudianteUnidadId,
      {
        include: [{ model: Unidad, as: "unidad" }],
      }
    );
    if (!estudianteUnidad) throw new Error("Asignación no encontrada");

    const servicio = await Servicio.findOne({
      where: { id: servicioId, activo: true },
    });
    if (!servicio) throw new Error("Servicio no encontrado o inactivo");
    if (servicio.es_base)
      throw new Error(
        "Los servicios base se agregan automáticamente al rentar"
      );

    // Verificar que el servicio está ofrecido por el rentero para esa unidad
    const ofertas = estudianteUnidad.unidad?.descripcion?.servicios || [];

    const ofrecido = ofertas.some((o) => {
      if (!o) return false;
      // si la oferta es un objeto con id
      if (typeof o === "object" && o.id !== undefined && o.id !== null) {
        return Number(o.id) === Number(servicio.id);
      }
      // si la oferta es un objeto con nombre o un string
      const nombreOferta = typeof o === "object" ? o.nombre : o;
      return (
        String(nombreOferta).trim().toLowerCase() ===
        String(servicio.nombre).trim().toLowerCase()
      );
    });

    if (!ofrecido)
      throw new Error("El servicio no está ofrecido para esta unidad");

    // Validar duplicado (existente con cualquier estado)
    const relacionExistente = await EstudianteUnidadServicio.findOne({
      where: {
        estudiante_unidad_id: estudianteUnidadId,
        servicio_id: servicioId,
      },
    });

    if (relacionExistente && relacionExistente.estado === "activo") {
      throw new Error("El servicio ya está agregado a esta asignación");
    }
    if (relacionExistente && relacionExistente.estado === "pendiente") {
      throw new Error("El servicio ya está programado para activarse");
    }

    // Determinar si es la primera adquisición del estudiante (no existen servicios activos)
    const tieneActivos = await EstudianteUnidadServicio.findOne({
      where: { estudiante_unidad_id: estudianteUnidadId, estado: "activo" },
    });

    let fechaInicio = new Date();
    let estado = "activo";
    if (tieneActivos) {
      // si ya tenía servicios activos antes, programar para inicio del mes siguiente
      const hoy = new Date();
      fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1, 0, 0, 0);
      estado = "pendiente";
    }

    // Crear relación con snapshot del precio
    await EstudianteUnidadServicio.create({
      estudiante_unidad_id: estudianteUnidadId,
      servicio_id: servicioId,
      precio_snapshot: servicio.precio,
      estado,
      fecha_inicio: fechaInicio,
    });

    // retornar cálculo actualizado (sólo servicios activos se sumarán)
    return await this.calcularPrecioConServicios(estudianteUnidadId);
  }

  /**
   * Elimina un servicio de la asignación de un estudiante
   * @param {number} estudianteUnidadId - ID de la asignación
   * @param {number} servicioId - ID del servicio
   * @returns {Promise<object>} - Resultado de la operación
   */
  async eliminarServicioDeAsignacion(estudianteUnidadId, servicioId) {
    const servicio = await Servicio.findByPk(servicioId);
    if (!servicio) throw new Error("Servicio no encontrado");

    if (servicio.es_base) throw new Error("No puedes eliminar servicios base");

    const relacion = await EstudianteUnidadServicio.findOne({
      where: {
        estudiante_unidad_id: estudianteUnidadId,
        servicio_id: servicioId,
      },
    });

    if (!relacion)
      throw new Error("El servicio no está asociado a esta asignación");

    const ahora = new Date();

    if (relacion.estado === "pendiente") {
      // si estaba pendiente, podemos eliminar el registro
      await relacion.destroy();
    } else if (relacion.estado === "activo") {
      // marcar la cancelación: fecha_fin = ahora y estado = 'cancelado'
      relacion.estado = "cancelado";
      relacion.fecha_fin = ahora;
      await relacion.save();
    } else {
      throw new Error("Operación no permitida en el estado actual");
    }

    return await this.calcularPrecioConServicios(estudianteUnidadId);
  }

  /**
   * Obtiene los servicios de una asignación específica
   * @param {number} estudianteUnidadId - ID de la asignación
   * @returns {Promise<Array>} - Array de servicios asociados
   */
  async obtenerServiciosPorAsignacion(estudianteUnidadId) {
    const estudianteUnidad = await EstudianteUnidad.findByPk(
      estudianteUnidadId,
      {
        include: [
          {
            model: Servicio,
            as: "servicios",
            through: { attributes: ["fecha_agregado"] },
          },
        ],
      }
    );

    if (!estudianteUnidad) {
      throw new Error("Asignación no encontrada");
    }

    return estudianteUnidad.servicios || [];
  }

  /**
   * Agrega servicios base automáticamente cuando un estudiante renta una unidad
   * @param {number} estudianteUnidadId - ID de la asignación recién creada
   * @param {Object} transaction - Transacción de Sequelize (opcional)
   * @returns {Promise<void>}
   */
  async agregarServiciosBaseAAsignacion(
    estudianteUnidadId,
    transaction = null
  ) {
    const serviciosBase = await this.obtenerServiciosBase();

    const options = transaction ? { transaction } : {};

    for (const servicio of serviciosBase) {
      await EstudianteUnidadServicio.create(
        {
          estudiante_unidad_id: estudianteUnidadId,
          servicio_id: servicio.id,
        },
        options
      );
    }
  }
}

export default new ServiciosService();
