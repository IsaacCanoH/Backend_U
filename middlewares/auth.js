import { verificarToken } from '../utils/auth/jwt.js';
import Rentero from '../models/rentero.js';

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
    
    // Verificar que el usuario aún existe
    const rentero = await Rentero.findByPk(decoded.id, {
      attributes: ['id', 'nombre', 'apellido', 'email', 'telefono']
    });

    if (!rentero) {
      return res.status(401).json({
        exito: false,
        mensaje: 'Usuario no encontrado'
      });
    }

    // Agregar información del usuario al request
    req.usuario = rentero.toJSON();
    
    next();
  } catch (error) {
    return res.status(403).json({
      exito: false,
      mensaje: 'Token inválido o expirado'
    });
  }
};