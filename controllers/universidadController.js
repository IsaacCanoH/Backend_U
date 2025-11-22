import UniversidadService from "../services/universidadService.js";

export const obtenerUniversidadesBasico = async (req, res, next) => {
  try {
    const resultado = await UniversidadService.obtenerUniversidadesBasico();
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};
