import EstudianteUnidad from "../models/estudiante_unidad.js";
import Unidad from "../models/unidad.js";
import Servicio from "../models/servicio.js";
import EstudianteUnidadServicio from "../models/estudiante_unidad_servicio.js";
import AsignacionPrecio from "../decorators/AsignacionPrecio.js";
import ServicioDecorator from "../decorators/ServicioDecorator.js";
import sequelize from "../config/baseDeDatos.js";

const sameDay = (a, b) => {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
};

const addMonths = (date, months) => {
  const d = new Date(date);
  return new Date(
    d.getFullYear(),
    d.getMonth() + months,
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds()
  );
};

const calcularBaseDateYNextPeriodo = async (estudianteUnidadId) => {
  const now = new Date();

  const existentes = await EstudianteUnidadServicio.findAll({
    where: { estudiante_unidad_id: estudianteUnidadId },
    order: [["fecha_inicio", "ASC"]],
  });

  if (!existentes.length) {
    return {
      baseDate: now,
      nextPeriodo: addMonths(now, 1),
      existentes,
    };
  }

  const baseDate = existentes[0].fecha_inicio
    ? new Date(existentes[0].fecha_inicio)
    : now;

  let next = new Date(baseDate);
  while (next <= now) {
    next = addMonths(next, 1);
  }

  return { baseDate, nextPeriodo: next, existentes };
};

class ServiciosService {
  /**
   * Calcula el precio total y el desglose para una asignación,
   * usando el patrón Decorator sobre los servicios VIGENTES:
   * - incluir servicios con estado === 'activo' (no exigir fecha_inicio <= now)
   * - incluir servicios con estado === 'pendiente' solo si fecha_inicio <= now
   * - respetar fecha_fin (si existe y <= now => excluir)
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

    // FILTRO CORREGIDO: incluir activos; pendientes solo si fecha_inicio <= now; excluir por fecha_fin
    const serviciosVigentes = (estudianteUnidad.servicios || []).filter(
      (srv) => {
        const link = srv.estudiante_unidad_servicio || {};
        const estado = String(link.estado || "activo").toLowerCase();
        const fi = link.fecha_inicio ? new Date(link.fecha_inicio) : null;
        const ff = link.fecha_fin ? new Date(link.fecha_fin) : null;

        // Si ya terminó (fecha_fin pasada o igual a ahora) => fuera
        if (ff && ff <= now) return false;

        // Pendiente: sólo entra cuando ya llegó su fecha_inicio
        if (estado === "pendiente") {
          return fi && fi <= now;
        }

        // Activo o cancelado (con fecha_fin en el futuro) siguen contando
        // hasta que llegue la fecha_fin
        if (estado === "activo" || estado === "cancelado") {
          if (fi && fi > now) return false; // aún no empieza
          return true;
        }

        // Otros estados => fuera
        return false;
      }
    );

    // componente base (unidad sin extras)
    let asignacionConPrecio = new AsignacionPrecio(
      estudianteUnidad,
      estudianteUnidad.unidad
    );

    // aplicar decoradores por cada servicio vigente (pasar through para precio_snapshot)
    for (const servicio of serviciosVigentes) {
      asignacionConPrecio = new ServicioDecorator(
        asignacionConPrecio,
        servicio,
        servicio.estudiante_unidad_servicio
      );
    }

    return asignacionConPrecio.getDescripcion();
  }

  /**
   * Agrega un servicio a la asignación (valida oferta por unidad).
   * Crea la relación con precio_snapshot y estado/fecha_inicio según reglas.
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

    const now = new Date();
    const { baseDate, nextPeriodo, existentes } =
      await calcularBaseDateYNextPeriodo(estudianteUnidadId);

    let fechaInicio;
    let estado;

    if (!existentes.length) {
      fechaInicio = baseDate; 
      estado = "activo";
    } else {
      const mismoDiaBaseYAhora = sameDay(baseDate, now);
      const todosMismoDiaBase = existentes.every((r) =>
        sameDay(r.fecha_inicio || baseDate, baseDate)
      );

      if (mismoDiaBaseYAhora && todosMismoDiaBase) {
        fechaInicio = baseDate;
        estado = "activo";
      } else {
        fechaInicio = nextPeriodo;
        estado = "pendiente";
      }
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

  async obtenerServiciosDisponibles({ soloAdicionales = false } = {}) {
    // construye el where para Sequelize
    const where = { activo: true };
    if (soloAdicionales) where.es_base = false;

    // orden alfabético para UX
    const servicios = await Servicio.findAll({
      where,
      order: [["nombre", "ASC"]],
    });

    // devolver array simple (si usas toJSON no es necesario)
    return servicios.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      precio: parseFloat(s.precio || 0),
      es_base: !!s.es_base,
      activo: !!s.activo,
    }));
  }

  async agregarServiciosBaseAAsignacion(
    estudianteUnidadId,
    unidad,
    transaction = null
  ) {
    const transOwn = !transaction;
    const t = transaction || (await sequelize.transaction());
    try {
      const servicios = unidad?.descripcion?.servicios || [];
      const bases = servicios.filter((s) => s && s.es_base);

      for (const s of bases) {
        const servicioId = Number(s.id);
        if (!servicioId) continue;

        const existente = await EstudianteUnidadServicio.findOne({
          where: {
            estudiante_unidad_id: estudianteUnidadId,
            servicio_id: servicioId,
          },
          transaction: t,
        });

        if (existente) {
          if (existente.estado !== "activo") {
            existente.estado = "activo";
            existente.fecha_inicio = existente.fecha_inicio || new Date();
            existente.precio_snapshot =
              existente.precio_snapshot || parseFloat(s.precio || 0);
            await existente.save({ transaction: t });
          }
          continue;
        }

        await EstudianteUnidadServicio.create(
          {
            estudiante_unidad_id: estudianteUnidadId,
            servicio_id: servicioId,
            precio_snapshot: parseFloat(s.precio || 0),
            estado: "activo",
            fecha_inicio: new Date(),
            fecha_agregado: new Date(),
          },
          { transaction: t }
        );
      }

      if (transOwn) await t.commit();
      return true;
    } catch (err) {
      if (transOwn) await t.rollback();
      console.error(
        "Error en agregarServiciosBaseAAsignacion:",
        err && (err.stack || err)
      );
      throw err;
    }
  }

  async eliminarServicioDeAsignacion(estudianteUnidadId, servicioId) {
    const relacion = await EstudianteUnidadServicio.findOne({
      where: {
        estudiante_unidad_id: estudianteUnidadId,
        servicio_id: servicioId,
      },
    });

    if (!relacion) {
      throw new Error("El servicio no está asociado a esta asignación");
    }

    const servicio = await Servicio.findByPk(servicioId);
    if (servicio && servicio.es_base) {
      throw new Error("No puedes eliminar servicios base");
    }

    const now = new Date();
    const { baseDate, nextPeriodo } = await calcularBaseDateYNextPeriodo(
      estudianteUnidadId
    );

    if (relacion.estado === "pendiente" && relacion.fecha_inicio > now) {
      relacion.estado = "cancelado";
      relacion.fecha_fin = relacion.fecha_inicio;
    } else {
      relacion.estado = "cancelado";
      relacion.fecha_fin = nextPeriodo;
    }

    await relacion.save();

    return await this.calcularPrecioConServicios(estudianteUnidadId);
  }
}

export default new ServiciosService();
