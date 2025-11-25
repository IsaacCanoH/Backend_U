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

/**
 * Usa estudiante_unidad.fecha_union como fecha de corte base
 * y calcula el siguiente corte a partir de refDate.
 */
const getFechaUnionYProximoCorte = async (
  estudianteUnidadId,
  refDate = new Date()
) => {
  const asignacion = await EstudianteUnidad.findByPk(estudianteUnidadId, {
    attributes: ["id", "fecha_union"],
  });
  if (!asignacion) throw new Error("Asignación no encontrada");

  const fechaUnion = asignacion.fecha_union
    ? new Date(asignacion.fecha_union)
    : new Date(refDate);

  let proximoCorte = new Date(fechaUnion);
  while (proximoCorte <= refDate) {
    proximoCorte = addMonths(proximoCorte, 1);
  }

  return { fechaUnion, proximoCorte };
};

class ServiciosService {
  /**
   * PRE-FACTURA:
   * Un servicio se cobra en la fechaFactura si:
   *  - fecha_inicio <= fechaFactura
   *  - y (fecha_fin es null o fecha_fin > fechaFactura)
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
    const { proximoCorte } = await getFechaUnionYProximoCorte(
      estudianteUnidadId,
      now
    );

    const todosServicios = estudianteUnidad.servicios || [];

    // 1) buscamos la menor fecha_inicio futura relevante
    let minFechaInicio = null;
    for (const srv of todosServicios) {
      const link = srv.estudiante_unidad_servicio || {};
      const fi = link.fecha_inicio ? new Date(link.fecha_inicio) : null;
      const ff = link.fecha_fin ? new Date(link.fecha_fin) : null;

      if (!fi) continue;
      // si ya terminó antes o en su propia fecha de inicio, ignóralo
      if (ff && ff <= fi) continue;

      if (!minFechaInicio || fi < minFechaInicio) {
        minFechaInicio = fi;
      }
    }

    // 2) fechaFactura = proximoCorte, pero si todos los servicios empiezan
    //    después de ese corte, saltamos a esa fecha_inicio
    let fechaFactura = proximoCorte;
    if (minFechaInicio && minFechaInicio > fechaFactura) {
      fechaFactura = minFechaInicio;
    }

    // 3) filtrar los servicios que estarán activos en esa fechaFactura
    const serviciosVigentes = todosServicios.filter((srv) => {
      const link = srv.estudiante_unidad_servicio || {};
      const fi = link.fecha_inicio ? new Date(link.fecha_inicio) : null;
      const ff = link.fecha_fin ? new Date(link.fecha_fin) : null;

      if (!fi) return false;

      // debe haber iniciado a más tardar en la fecha de factura
      if (fi > fechaFactura) return false;

      // si tiene fecha_fin y es <= a la fecha de factura, ya no se cobra
      if (ff && ff <= fechaFactura) return false;

      return true;
    });

    // componente base (unidad sin extras)
    let asignacionConPrecio = new AsignacionPrecio(
      estudianteUnidad,
      estudianteUnidad.unidad
    );

    // aplicar decoradores por cada servicio vigente para ese corte
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
   * Reglas de fechas:
   * - Si lo agrega el mismo día de fecha_union => fecha_inicio = hoy, estado = 'activo'
   * - Si lo agrega después de fecha_union     => fecha_inicio = próximo corte, estado = 'pendiente'
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
    const { fechaUnion, proximoCorte } = await getFechaUnionYProximoCorte(
      estudianteUnidadId,
      now
    );

    let fechaInicio;
    let estado;

    if (sameDay(fechaUnion, now)) {
      // Lo agregó el mismo día que se unió (fecha corte)
      fechaInicio = now;
      estado = "activo";
    } else {
      // Lo agregó después: arranca en el siguiente corte
      fechaInicio = proximoCorte;
      estado = "pendiente";
    }

    await EstudianteUnidadServicio.create({
      estudiante_unidad_id: estudianteUnidadId,
      servicio_id: servicioId,
      precio_snapshot: servicio.precio,
      estado,
      fecha_inicio: fechaInicio,
      fecha_agregado: now,
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
    const where = { activo: true };
    if (soloAdicionales) where.es_base = false;

    const servicios = await Servicio.findAll({
      where,
      order: [["nombre", "ASC"]],
    });

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

  /**
   * Cancelar servicio extra:
   * - Si cancela ANTES de fecha_inicio  => no se cobra, fecha_fin = ahora
   * - Si cancela DESPUÉS de fecha_inicio => se cobra ciclo completo, fecha_fin = próximo corte
   */
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
    const { proximoCorte } = await getFechaUnionYProximoCorte(
      estudianteUnidadId,
      now
    );

    const fi = relacion.fecha_inicio ? new Date(relacion.fecha_inicio) : null;

    if (fi && now < fi) {
      // canceló antes de que empezara a cobrarse: no entra a ningún corte
      relacion.estado = "cancelado";
      relacion.fecha_fin = now;
    } else {
      // ya estaba o va a estar en el corte actual: se cobra hasta el siguiente
      relacion.estado = "cancelado";
      relacion.fecha_fin = proximoCorte;
    }

    await relacion.save();

    return await this.calcularPrecioConServicios(estudianteUnidadId);
  }
}

export default new ServiciosService();
