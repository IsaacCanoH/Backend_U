import express from 'express';
import { autenticarToken } from '../middlewares/auth.js';
import {
  serviciosDisponibles,
  obtenerServiciosBase,
  calcularPrecioAsignacion,
  agregarServicioAAsignacion,
  eliminarServicioDeAsignacion,
  obtenerServiciosPorAsignacion
} from '../controllers/serviciosController.js';

const router = express.Router();

// Rutas públicas (consultar servicios disponibles)
router.get('/disponibles', serviciosDisponibles);
router.get('/base', obtenerServiciosBase);

// Rutas protegidas (requieren autenticación)
// Trabajan con asignaciones estudiante-unidad, no con unidades directamente

// Obtener servicios de una asignación específica (estudiante-unidad)
router.get('/asignacion/:estudianteUnidadId', autenticarToken, obtenerServiciosPorAsignacion);

// Calcular precio total de una asignación con sus servicios personalizados
router.get('/asignacion/:estudianteUnidadId/precio', autenticarToken, calcularPrecioAsignacion);

// Agregar un servicio a la asignación de un estudiante
router.post('/asignacion/:estudianteUnidadId/agregar', autenticarToken, agregarServicioAAsignacion);

// Eliminar un servicio de la asignación de un estudiante
router.delete('/asignacion/:estudianteUnidadId/servicio/:servicioId', autenticarToken, eliminarServicioDeAsignacion);

export default router;
