import express from 'express';

import cargarArchivo from "../middlewares/cargarArchivo.js";

import {
  registrarRentero,
  iniciarSesion,
  validarToken,
  cerrarSesion,
  obtenerPerfil
} from '../controllers/renteroController.js';

import { autenticarToken } from '../middlewares/auth.js';

const router = express.Router();

router.post('/registrar', cargarArchivo.single("documento"), registrarRentero);
router.post('/login', iniciarSesion);

router.get('/validar', autenticarToken, validarToken);
router.post('/logout', cerrarSesion);
router.get('/perfil', autenticarToken, obtenerPerfil);

export default router;