import * as estudianteService from "../services/estudianteService.js";
import { ErrorDocumento, ErrorBaseDatos } from "../utils/errores/erroresDocumento.js";

export const registrarEstudiante = async (req, res, next) => {
  try {

    const datosEstudiante = req.body;

    const resultado = await estudianteService.registrarEstudiante(
      datosEstudiante
    );

    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
};

export const iniciarSesion = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validar que se proporcionen email y contraseña
    if (!email || !password) {
      throw new ErrorBaseDatos('Email y contraseña son requeridos');
    }

    const resultado = await estudianteService.iniciarSesion(email, password);

    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};

export const validarToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Obtener token del header "Bearer TOKEN"

    if (!token) {
      throw new ErrorBaseDatos('Token no proporcionado');
    }

    const resultado = await estudianteService.validarToken(token);

    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};

export const cerrarSesion = async (req, res, next) => {
  try {
    // En JWT no necesitamos hacer nada en el servidor para cerrar sesión
    // El cliente simplemente elimina el token
    res.status(200).json({
      exito: true,
      mensaje: 'Sesión cerrada exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

export const obtenerPerfil = async (req, res, next) => {
  try {
    // req.usuario viene del middleware de autenticación
    res.status(200).json({
      exito: true,
      datos: req.usuario
    });
  } catch (error) {
    next(error);
  }
};

// Obtener lista de unidades del estudiante autenticado
export const obtenerUnidadesEstudiante = async (req, res, next) => {
  try {
    const estudianteId = req.usuario.id;
    const resultado = await estudianteService.obtenerUnidadesAsignadas(estudianteId);
    res.status(200).json({ success: true, data: resultado });
  } catch (error) {
    next(error);
  }
};

// Obtener detalle de una unidad si el estudiante está relacionado con ella
export const obtenerUnidadAsignadaPorId = async (req, res, next) => {
  try {
    const estudianteId = req.usuario.id;
    const unidadId = +req.params.unidadId;
    const resultado = await estudianteService.obtenerUnidadAsignadaPorId(estudianteId, unidadId);
    res.status(200).json({ success: true, data: resultado });
  } catch (error) {
    next(error);
  }
};
