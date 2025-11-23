import Estudiante from '../models/estudiante.js';
import Unidad from '../models/unidad.js';
import Propiedad from '../models/propiedad.js';
import Rentero from '../models/rentero.js';
import EstudianteUnidad from '../models/estudiante_unidad.js';
import sequelize from '../config/baseDeDatos.js';
import * as documentoService from './documentoService.js';
import { generarToken } from '../utils/auth/jwt.js';

import { ErrorBaseDatos, ErrorDocumento } from '../utils/errores/erroresDocumento.js';

export const registrarEstudiante = async (datosEstudiante) => {

  return await Estudiante.create(datosEstudiante);
};

export const iniciarSesion = async (email, password) => {
  try {
    // Buscar el usuario por email
    const estudiante = await Estudiante.findOne({
      where: { email },
      attributes: ['id', 'nombre', 'apellido', 'email', 'password', 'telefono']
    });

    if (!estudiante) {
      throw new ErrorBaseDatos('Credenciales inválidas');
    }

    // Verificar la contraseña
    const passwordValida = await estudiante.verificarPassword(password);

    if (!passwordValida) {
      throw new ErrorBaseDatos('Credenciales inválidas');
    }

    // Generar token JWT
    const token = generarToken({
      id: estudiante.id,
      email: estudiante.email,
      nombre: estudiante.nombre,
      apellido: estudiante.apellido,
      tipo: 'estudiante'
    });

    // Retornar datos del usuario sin la contraseña
    const { password: _, ...datosEstudiante } = estudiante.toJSON();

    return {
      exito: true,
      mensaje: 'Inicio de sesión exitoso',
      datos: {
        estudiante: datosEstudiante,
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
    const estudiante = await Estudiante.findByPk(decoded.id, {
      attributes: ['id', 'nombre', 'apellido', 'email', 'telefono']
    });

    if (!estudiante) {
      throw new ErrorBaseDatos('Usuario no encontrado');
    }

    return {
      exito: true,
      datos: {
        estudiante: estudiante.toJSON(),
        tokenValido: true
      }
    };

  } catch (error) {
    throw new ErrorBaseDatos('Token inválido o expirado');
  }
};


export const obtenerUnidadesAsignadas = async (estudianteId) => {
  const relaciones = await EstudianteUnidad.findAll({
    where: { estudiante_id: estudianteId },
    include: [{
      model: Unidad,
      as: 'unidad',
      include: [
        { model: Propiedad, as: 'propiedad', include: [{ model: Rentero, as: 'rentero' }] }
      ]
    }]
  });

  // Mapear a un arreglo de unidades (clean)
  return relaciones.map(r => {
    const u = r.unidad ? r.unidad.toJSON() : null;
    if (!u) return null;
    return {
      id: u.id,
      nombre: u.nombre,
      precio: u.precio,
      descripcion: u.descripcion,
      imagenes: u.imagenes || [],
      propiedad: u.propiedad ? {
        id: u.propiedad.id,
        nombre: u.propiedad.nombre,
        ubicacion: u.propiedad.ubicacion
      } : null,
      rentero: u.propiedad?.rentero ? {
        id: u.propiedad.rentero.id,
        nombre: u.propiedad.rentero.nombre,
        email: u.propiedad.rentero.email,
        telefono: u.propiedad.rentero.telefono
      } : null
    };
  }).filter(x => x !== null);
};

export const obtenerUnidadAsignadaPorId = async (estudianteId, unidadId) => {
  const relacion = await EstudianteUnidad.findOne({
    where: { estudiante_id: estudianteId, unidad_id: unidadId },
    include: [{
      model: Unidad,
      as: 'unidad',
      include: [
        { model: Propiedad, as: 'propiedad', include: [{ model: Rentero, as: 'rentero' }] }
      ]
    }]
  });

  if (!relacion || !relacion.unidad) {
    const err = new Error('Unidad no encontrada o no asignada al estudiante');
    err.status = 404;
    throw err;
  }

  const u = relacion.unidad.toJSON();
  return {
    id: u.id,
    nombre: u.nombre,
    precio: u.precio,
    descripcion: u.descripcion,
    imagenes: u.imagenes || [],
    propiedad: u.propiedad ? {
      id: u.propiedad.id,
      nombre: u.propiedad.nombre,
      ubicacion: u.propiedad.ubicacion
    } : null,
    rentero: u.propiedad?.rentero ? {
      id: u.propiedad.rentero.id,
      nombre: u.propiedad.rentero.nombre,
      email: u.propiedad.rentero.email,
      telefono: u.propiedad.rentero.telefono
    } : null
  };
};

