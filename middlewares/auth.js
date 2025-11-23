import { verificarToken } from '../utils/auth/jwt.js';
import Rentero from '../models/rentero.js';
import Estudiante from '../models/estudiante.js';

export const autenticarToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer TOKEN"

    if (!token) {
      return res.status(401).json({
        exito: false,
        mensaje: 'Token de acceso requerido'
      });
    }

    // Verificar el token
    const decoded = verificarToken(token);

    // Determinar el tipo de usuario y buscar en la tabla correspondiente
    let usuario = null;

    if (decoded.tipo === 'estudiante') {
      usuario = await Estudiante.findByPk(decoded.id, {
        attributes: ['id', 'nombre', 'apellido', 'email', 'telefono']
      });
    } else {
      // Por defecto buscar en renteros (para compatibilidad con tokens antiguos)
      usuario = await Rentero.findByPk(decoded.id, {
        attributes: ['id', 'nombre', 'apellido', 'email', 'telefono']
      });
    }

    if (!usuario) {
      return res.status(401).json({
        exito: false,
        mensaje: 'Usuario no encontrado'
      });
    }

    // Agregar información del usuario al request
    req.usuario = { ...usuario.toJSON(), tipo: decoded.tipo || 'rentero' };

    next();
  } catch (error) {
    return res.status(403).json({
      exito: false,
      mensaje: 'Token inválido o expirado'
    });
  }
};