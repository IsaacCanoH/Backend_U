// Backend_U/services/serviciosService.js
import EstudianteUnidad from "../models/estudiante_unidad.js";
import Unidad from "../models/unidad.js";
import Servicio from "../models/servicio.js";
import EstudianteUnidadServicio from "../models/estudiante_unidad_servicio.js";
import AsignacionPrecio from "../decorators/AsignacionPrecio.js";
import ServicioDecorator from "../decorators/ServicioDecorator.js";
import sequelize from "../config/baseDeDatos.js";

class ServiciosService {
  /**
   * Calcula el precio total y el desglose para una asignación,
   * usando el patrón Decorator sobre los servicios VIGENTES:
   * - estado === 'activo'
   * - fecha_inicio <= ahora
   * - fecha_fin === null || fecha_fin > ahora
   */
  async calcularPrecioConServicios(estudianteUnidadId) {
    const estudianteUnidad = await EstudianteUnidad.findByPk(
      estudianteUnidadId,
      {
        include: [
          {
            model: Unidad,
            as: "unidad",
            required: true,
          },
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
    // filtrar servicios vigentes por la relación (through)

    // const serviciosVigentes = (estudianteUnidad.servicios || []).filter(srv => {
    //   const link = srv.estudiante_unidad_servicio || {};
    //   const estado = (link.estado || 'activo').toLowerCase();
    //   const fi = link.fecha_inicio ? new Date(link.fecha_inicio) : new Date(0);
    //   const ff = link.fecha_fin ? new Date(link.fecha_fin) : null;
    //   return estado === 'activo' && fi <= now && (!ff || ff > now);
    // });

    // filtrar servicios vigentes por la relación (through)
    const serviciosVigentes = (estudianteUnidad.servicios || []).filter(
      (srv) => {
        const link = srv.estudiante_unidad_servicio || {};
        const estado = String(link.estado || "activo").toLowerCase();
        const fi = link.fecha_inicio ? new Date(link.fecha_inicio) : null;
        const ff = link.fecha_fin ? new Date(link.fecha_fin) : null;

        // si está cancelado o fecha_fin pasada, excluir
        if (ff && ff <= now) return false;

        // Si está activo → incluir (no exigir fi <= now)
        if (estado === "activo") return true;

        // Si está pendiente → incluir solo si ya llegó su fecha_inicio
        if (estado === "pendiente") {
          return fi && fi <= now;
        }

        // otros estados (cancelado, etc.) => excluir
        return false;
      }
    );

    // componente base
    let asignacionConPrecio = new AsignacionPrecio(
      estudianteUnidad,
      estudianteUnidad.unidad
    );

    // aplicar decoradores por cada servicio vigente (usando precio_snapshot si existe)
    for (const servicio of serviciosVigentes) {
      // pasar el objeto through para que el decorator use precio_snapshot/estado/fecha_inicio
      asignacionConPrecio = new ServicioDecorator(
        asignacionConPrecio,
        servicio,
        servicio.estudiante_unidad_servicio
      );
    }

    return asignacionConPrecio.getDescripcion();
  }

  /**
   * Agrega un servicio a la asignación (ya corregida, valida oferta por unidad).
   * Mantiene snapshot, estado y fecha_inicio según regla (primera vez -> activo; si había activos -> pendiente al siguiente mes).
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
      if (typeof o === "object" && o.id !== undefined && o.id !== null) {
        return Number(o.id) === Number(servicio.id);
      }
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
      const hoy = new Date();
      fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1, 0, 0, 0);
      estado = "pendiente";
    }

    await EstudianteUnidadServicio.create({
      estudiante_unidad_id: estudianteUnidadId,
      servicio_id: servicioId,
      precio_snapshot: servicio.precio,
      estado,
      fecha_inicio: fechaInicio,
    });

    return await this.calcularPrecioConServicios(estudianteUnidadId);
  }

  /**
   * Devuelve los servicios asociados a una asignación (incluye through attrs).
   */
  async obtenerServiciosPorAsignacion(estudianteUnidadId) {
    const row = await EstudianteUnidad.findByPk(estudianteUnidadId, {
      include: [
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
    });
    if (!row) throw new Error("Asignación no encontrada");
    return row.servicios || [];
  }

  /**
   * Elimina/cancela un servicio de la asignación (mantener historial).
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
      await relacion.destroy();
    } else if (relacion.estado === "activo") {
      relacion.estado = "cancelado";
      relacion.fecha_fin = ahora;
      await relacion.save();
    } else {
      throw new Error("Operación no permitida en el estado actual");
    }

    return await this.calcularPrecioConServicios(estudianteUnidadId);
  }
}

export default new ServiciosService();
