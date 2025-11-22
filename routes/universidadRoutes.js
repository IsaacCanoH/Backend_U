import express from "express";
import { obtenerUniversidadesBasico } from "../controllers/universidadController.js";

const router = express.Router();
router.get("/", obtenerUniversidadesBasico);

export default router;
