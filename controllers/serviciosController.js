import ServiciosService from "../services/serviciosService.js";
import EstudianteUnidad from "../models/estudiante_unidad.js";

/**
 * Obtiene todos los servicios disponibles
 * GET /api/servicios/disponibles
 */
export const serviciosDisponibles = async (req, res, next) => {
  try {
    // opcional: ?solo_adicionales=true para traer solo es_base = false
    const soloAdicionales =
      String(req.query.solo_adicionales || "").toLowerCase() === "true";

    const servicios = await ServiciosService.obtenerServiciosDisponibles({
      soloAdicionales,
    });

    return res.status(200).json({ success: true, data: servicios });
  } catch (err) {
    console.error("ERROR /servicios/disponibles:", err && (err.stack || err));
    return res
      .status(500)
      .json({ success: false, mensaje: "Error interno del servidor" });
  }
};

/**
 * Obtiene los servicios base (agua, luz, internet)
 * GET /api/servicios/base
 */
export const obtenerServiciosBase = async (req, res, next) => {
  try {
    const servicios = await ServiciosService.obtenerServiciosBase();

    res.status(200).json({
      success: true,
      data: servicios,
      mensaje: "Servicios base obtenidos exitosamente",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Calcula el precio total de una asignación (estudiante-unidad) con sus servicios
 * GET /api/servicios/asignacion/:estudianteUnidadId/precio
 */
export const calcularPrecioAsignacion = async (req, res, next) => {
  try {
    const { estudianteUnidadId } = req.params;

    if (!estudianteUnidadId || isNaN(estudianteUnidadId)) {
      return res.status(400).json({
        success: false,
        mensaje: "ID de asignación inválido",
      });
    }

    const detallePrecios = await ServiciosService.calcularPrecioConServicios(
      parseInt(estudianteUnidadId)
    );

    res.status(200).json({
      success: true,
      data: detallePrecios,
      mensaje: "Precio calculado exitosamente",
    });
  } catch (error) {
    if (
      error.message === "Asignación no encontrada" ||
      error.message === "Unidad asociada no encontrada"
    ) {
      return res.status(404).json({
        success: false,
        mensaje: error.message,
      });
    }
    next(error);
  }
};

/**
 * Agrega un servicio a la asignación de un estudiante
 * POST /api/servicios/asignacion/:estudianteUnidadId/agregar
 * Body: { servicio_id: number }
 */
export const agregarServicioAAsignacion = async (req, res, next) => {
  try {
    const { estudianteUnidadId } = req.params;
    const { servicio_id } = req.body;

    if (!estudianteUnidadId || isNaN(estudianteUnidadId)) {
      return res.status(400).json({
        success: false,
        mensaje: "ID de asignación inválido",
      });
    }

    if (!servicio_id || isNaN(servicio_id)) {
      return res.status(400).json({
        success: false,
        mensaje: "ID de servicio inválido",
      });
    }

    const resultado = await ServiciosService.agregarServicioAAsignacion(
      parseInt(estudianteUnidadId),
      parseInt(servicio_id)
    );

    res.status(200).json({
      success: true,
      data: resultado,
      mensaje: "Servicio agregado exitosamente",
    });
  } catch (error) {
    if (
      error.message === "Asignación no encontrada" ||
      error.message === "Servicio no encontrado o inactivo"
    ) {
      return res.status(404).json({
        success: false,
        mensaje: error.message,
      });
    }

    if (
      error.message === "El servicio ya está agregado a esta asignación" ||
      error.message ===
        "Los servicios base se agregan automáticamente al rentar"
    ) {
      return res.status(400).json({
        success: false,
        mensaje: error.message,
      });
    }

    next(error);
  }
};

/**
 * Elimina un servicio de la asignación de un estudiante
 * DELETE /api/servicios/asignacion/:estudianteUnidadId/servicio/:servicioId
 */
export const eliminarServicioDeAsignacion = async (req, res, next) => {
  try {
    const { estudianteUnidadId, servicioId } = req.params;

    if (
      !estudianteUnidadId ||
      isNaN(estudianteUnidadId) ||
      !servicioId ||
      isNaN(servicioId)
    ) {
      return res.status(400).json({
        success: false,
        mensaje: "IDs inválidos",
      });
    }

    const resultado = await ServiciosService.eliminarServicioDeAsignacion(
      parseInt(estudianteUnidadId),
      parseInt(servicioId)
    );

    res.status(200).json({
      success: true,
      data: resultado,
      mensaje: "Servicio eliminado exitosamente",
    });
  } catch (error) {
    if (error.message === "El servicio no está asociado a esta asignación") {
      return res.status(404).json({
        success: false,
        mensaje: error.message,
      });
    }

    if (error.message === "No puedes eliminar servicios base") {
      return res.status(400).json({
        success: false,
        mensaje: error.message,
      });
    }

    next(error);
  }
};

/**
 * Obtiene los servicios de una asignación específica
 * GET /api/servicios/asignacion/:estudianteUnidadId
 */
export const obtenerServiciosPorAsignacion = async (req, res, next) => {
  try {
    const { estudianteUnidadId } = req.params;

    if (!estudianteUnidadId || isNaN(estudianteUnidadId)) {
      return res.status(400).json({
        success: false,
        mensaje: "ID de asignación inválido",
      });
    }

    const servicios = await ServiciosService.obtenerServiciosPorAsignacion(
      parseInt(estudianteUnidadId)
    );

    res.status(200).json({
      success: true,
      data: servicios,
      mensaje: "Servicios obtenidos exitosamente",
    });
  } catch (error) {
    if (error.message === "Asignación no encontrada") {
      return res.status(404).json({
        success: false,
        mensaje: error.message,
      });
    }
    next(error);
  }
};

export const enviarPrefacturaAsignacion = async (req, res, next) => {
  try {
    const { estudianteUnidadId } = req.params;

    if (!estudianteUnidadId || isNaN(estudianteUnidadId)) {
      return res.status(400).json({
        success: false,
        mensaje: "ID de asignación inválido",
      });
    }

    const detalle = await ServiciosService.enviarPrefacturaPorCorreo(
      parseInt(estudianteUnidadId)
    );

    return res.status(200).json({
      success: true,
      data: detalle,
      mensaje: "Pre-factura enviada por correo correctamente",
    });
  } catch (error) {
    console.error("Error al enviar pre-factura:", error);
    next(error);
  }
};
