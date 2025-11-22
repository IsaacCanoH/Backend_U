import express from 'express';

import {obtenerDocumentos} from '../controllers/documentoController.js';

const router = express.Router();

router.get('/', obtenerDocumentos);

export default router;