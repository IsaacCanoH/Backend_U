import * as renteroService from "../services/renteroService.js";
import { ErrorDocumento, ErrorBaseDatos } from "../utils/errores/erroresDocumento.js";

export const registrarRentero = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ErrorDocumento('Debe proporcionar un documento válido');
    }

    const { tipo_id, ...datosRentero } = req.body;
    
    const resultado = await renteroService.registrarRentero(
      req.file.path,
      tipo_id,
      datosRentero
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

    const resultado = await renteroService.iniciarSesion(email, password);
    
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

    const resultado = await renteroService.validarToken(token);
    
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