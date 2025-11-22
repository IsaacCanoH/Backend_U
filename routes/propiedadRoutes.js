import express from "express";

import cargarArchivo from "../middlewares/cargarArchivo.js";
import { autenticarToken } from "../middlewares/auth.js";

import {
  obtenerPropiedades,
  obtenerPropiedadPorId,
  obtenerPropiedadesConFiltros,
  registrarPropiedad,
  eliminarPropiedad,
  actualizarPropiedad,
  obtenerPropiedadesDelRentero,
  registrarUnidad,
  obtenerUnidadesPorPropiedad,
  obtenerUnidadPorId,
  actualizarUnidad,
  eliminarUnidad,
} from "../controllers/propiedadController.js";

const router = express.Router();

// Rutas públicas (sin autenticación)
router.get("/", obtenerPropiedades);
router.get("/filtrar", obtenerPropiedadesConFiltros);
router.get("/:id", obtenerPropiedadPorId);

// Rutas para registrar propiedades (requieren autenticación)
router.post(
  "/registrar",
  cargarArchivo.single("documento"),
  (req, res, next) => {
    try {
      const { body } = req;

      if (body.ubicacion && typeof body.ubicacion === "string") {
        body.ubicacion = JSON.parse(body.ubicacion);
      }

      if (
        body.ubicacion?.coordinates &&
        typeof body.ubicacion.coordinates === "string"
      ) {
        body.ubicacion.coordinates = JSON.parse(body.ubicacion.coordinates);
      }

      if (body.tipo_id) body.tipo_id = parseInt(body.tipo_id);
      if (body.rentero_id) body.rentero_id = parseInt(body.rentero_id);

      if (body.visible !== undefined) {
        body.visible = body.visible === "true" || body.visible === true;
      }

      next();
    } catch (error) {
      res.status(400).json({
        error: "Datos inválidos",
        detalle: error.message,
      });
    }
  },
  registrarPropiedad
);

router.delete('/eliminar/:propiedadId', autenticarToken, eliminarPropiedad);

router.get(
  "/rentero/mis-propiedades",
  autenticarToken,
  obtenerPropiedadesDelRentero
);

router.post(
  "/unidades/registrar",
  autenticarToken,
  (req, res, next) => {
    try {
      const { body } = req;

      // Conversiones de tipos
      if (body.propiedad_id) body.propiedad_id = parseInt(body.propiedad_id);
      if (body.precio) body.precio = parseFloat(body.precio);

      // Parsear descripcion si viene como string JSON
      if (body.descripcion && typeof body.descripcion === "string") {
        try {
          body.descripcion = JSON.parse(body.descripcion);
        } catch (e) {
          // Si no es JSON válido, mantener como string
          // body.descripcion permanece como string
        }
      }

      // Parsear imagenes si viene como string JSON
      if (body.imagenes && typeof body.imagenes === "string") {
        try {
          body.imagenes = JSON.parse(body.imagenes);
        } catch (e) {
          // Si no es JSON válido, mantener como string
          // body.imagenes permanece como string
        }
      }

      next();
    } catch (error) {
      res.status(400).json({
        error: "Datos inválidos",
        detalle: error.message,
      });
    }
  },
  registrarUnidad
);

router.put(
  "/:propiedadId",
  autenticarToken,
  (req, res, next) => {
    try {
      const { body } = req;

      if (body.ubicacion && typeof body.ubicacion === "string") {
        body.ubicacion = JSON.parse(body.ubicacion);
      }

      if (
        body.ubicacion?.coordinates &&
        typeof body.ubicacion.coordinates === "string"
      ) {
        body.ubicacion.coordinates = JSON.parse(body.ubicacion.coordinates);
      }

      if (body.visible !== undefined) {
        body.visible = body.visible === "true" || body.visible === true;
      }

      next();
    } catch (error) {
      res.status(400).json({
        error: "Datos inválidos",
        detalle: error.message,
      });
    }
  },
  actualizarPropiedad
);

// Obtener unidades de una propiedad específica
router.get(
  "/unidades/propiedad/:propiedadId",
  autenticarToken,
  obtenerUnidadesPorPropiedad
);

router.get("/unidades/:unidadId", autenticarToken, obtenerUnidadPorId);

// Actualizar unidad
router.put(
  "/unidades/:unidadId",
  autenticarToken,
  (req, res, next) => {
    try {
      const { body } = req;

      // Conversiones de tipos
      if (body.precio) body.precio = parseFloat(body.precio);

      // Parsear descripcion si viene como string JSON
      if (body.descripcion && typeof body.descripcion === "string") {
        try {
          body.descripcion = JSON.parse(body.descripcion);
        } catch (e) {
          // Si no es JSON válido, mantener como string
        }
      }

      // Parsear imagenes si viene como string JSON
      if (body.imagenes && typeof body.imagenes === "string") {
        try {
          body.imagenes = JSON.parse(body.imagenes);
        } catch (e) {
          // Si no es JSON válido, mantener como string
        }
      }

      next();
    } catch (error) {
      res.status(400).json({
        error: "Datos inválidos",
        detalle: error.message,
      });
    }
  },
  actualizarUnidad
);

router.delete("/unidades/:unidadId", autenticarToken, eliminarUnidad);

export default router;
