import jwt from 'jsonwebtoken';

// Asegúrate de tener esta variable en tu archivo .env
const JWT_SECRET = process.env.JWT_SECRET || 'mwefJhjsdfHSDh123bj12hbj3JDHASJKASksds';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

export const generarToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRE
  });
};

export const verificarToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Token inválido');
  }
};

export const decodificarToken = (token) => {
  return jwt.decode(token);
};