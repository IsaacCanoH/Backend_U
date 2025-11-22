import Rentero from '../models/rentero.js';
import sequelize from '../config/baseDeDatos.js';
import * as documentoService from './documentoService.js';
import { generarToken } from '../utils/auth/jwt.js';

import { limpiarArchivoTemporal } from '../utils/files/manejadorArchivos.js';
import { ErrorBaseDatos, ErrorDocumento } from '../utils/errores/erroresDocumento.js';

export const registrarRentero = async (rutaDocumento, tipo_id, datosRentero) => {
  if (!rutaDocumento) {
    throw new ErrorDocumento('Debe proporcionar un documento válido');
  }

  const [emailExistente, telefonoExistente] = await Promise.all([
  Rentero.findOne({ where: { email: datosRentero.email } }),
  Rentero.findOne({ where: { telefono: datosRentero.telefono } })
  ]);

  if (emailExistente) {
    throw new ErrorBaseDatos('Ya existe un usuario registrado con ese correo electronico');
  } else if (telefonoExistente) {
    throw new ErrorBaseDatos('Ya existe un usuario registrado con ese telefono');
  }

  const transaccion = await sequelize.transaction();

  try {
    const nuevoRentero = await crearRentero(datosRentero, transaccion);
    const nombreCompletoFormulario = [datosRentero.nombre, datosRentero.apellido].filter(Boolean).join(' ').trim();
    const opcionesValidacionDocumento = nombreCompletoFormulario ? { nombreFormulario: nombreCompletoFormulario } : {};
    const { rutaFinal } = await documentoService.procesarDocumento(
      rutaDocumento,
      tipo_id,
      opcionesValidacionDocumento
    );

    const nuevoDocumento = await documentoService.guardarDocumento(
      rutaFinal, 
      tipo_id, 
      nuevoRentero.id, 
      null, 
      transaccion
    );

    await transaccion.commit();
    
    return {
      exito: true,
      mensaje: 'Rentero registrado exitosamente',
      datos: { rentero: nuevoRentero, documento: nuevoDocumento }
    };
  } catch (error) {
    await transaccion.rollback();
    limpiarArchivoTemporal(rutaDocumento);
    throw manejarErrorRegistro(error);
  }
};

export const iniciarSesion = async (email, password) => {
  try {
    // Buscar el usuario por email
    const rentero = await Rentero.findOne({ 
      where: { email },
      attributes: ['id', 'nombre', 'apellido', 'email', 'password', 'telefono']
    });

    if (!rentero) {
      throw new ErrorBaseDatos('Credenciales inválidas');
    }

    // Verificar la contraseña
    const passwordValida = await rentero.verificarPassword(password);
    
    if (!passwordValida) {
      throw new ErrorBaseDatos('Credenciales inválidas');
    }

    // Generar token JWT
    const token = generarToken({
      id: rentero.id,
      email: rentero.email,
      nombre: rentero.nombre,
      apellido: rentero.apellido
    });

    // Retornar datos del usuario sin la contraseña
    const { password: _, ...datosRentero } = rentero.toJSON();

    return {
      exito: true,
      mensaje: 'Inicio de sesión exitoso',
      datos: {
        rentero: datosRentero,
        token
      }
    };

  } catch (error) {
    throw error;
  }
};

export const validarToken = async (token) => {
  try {
    const { verificarToken } = await import('../utils/auth/jwt.js');
    const decoded = verificarToken(token);
    
    // Verificar que el usuario aún existe en la base de datos
    const rentero = await Rentero.findByPk(decoded.id, {
      attributes: ['id', 'nombre', 'apellido', 'email', 'telefono']
    });

    if (!rentero) {
      throw new ErrorBaseDatos('Usuario no encontrado');
    }

    return {
      exito: true,
      datos: {
        rentero: rentero.toJSON(),
        tokenValido: true
      }
    };

  } catch (error) {
    throw new ErrorBaseDatos('Token inválido o expirado');
  }
};

const crearRentero = async (datosRentero, transaccion) => {
  return await Rentero.create(datosRentero, { transaction: transaccion });
};

const manejarErrorRegistro = (error) => {
  if (error.name === 'SequelizeUniqueConstraintError') {
    const camposDuplicados = error.errors.map(e => e.path).join(', ');
    return new ErrorBaseDatos(`Ya existe un registro con el mismo ${camposDuplicados}`);
  }
  
  if (error.name === 'SequelizeValidationError') {
    const mensajesError = error.errors.map(e => e.message).join(', ');
    return new ErrorBaseDatos(`Error de validación: ${mensajesError}`);
  }
  
  return error;
};