import PropiedadService from "../services/propiedadService.js";
import { ErrorDocumento } from "../utils/errores/erroresDocumento.js";


export const obtenerPropiedades = async (req, res, next) => {
  try {
    const resultado = await PropiedadService.obtenerTodasLasPropiedades();
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};

export const obtenerPropiedadPorId = async (req, res, next) => {
  try {
    const { id } = req.params;
    const resultado = await PropiedadService.obtenerPropiedadPorId(id);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};

export const obtenerPropiedadesConFiltros = async (req, res, next) => {
  try {
    const {
      precioMin,
      precioMax,
      colonia,
      municipio,
      universidadId,
      universidadNombre,
      rangoKm,
    } = req.query;

    const filtros = {};
    if (precioMin) filtros.precioMin = parseFloat(precioMin);
    if (precioMax) filtros.precioMax = parseFloat(precioMax);
    if (colonia) filtros.colonia = colonia;
    if (municipio) filtros.municipio = municipio;
    if (universidadId) filtros.universidadId = parseInt(universidadId, 10);
    if (universidadNombre) filtros.universidadNombre = universidadNombre;
    if (rangoKm) filtros.rangoKm = parseFloat(rangoKm);

    const resultado = await PropiedadService.buscarPropiedadesConFiltros(filtros);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};

export const registrarPropiedad = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ErrorDocumento('Debe proporcionar un documento válido');
    }
    const { tipo_id, ...datosPropiedad } = req.body;

    if (!datosPropiedad || Object.keys(datosPropiedad).length === 0) {
      throw new Error("No se proporcionaron datos de la propiedad");
    }

    if (!datosPropiedad.nombre) {
      throw new Error('El campo nombre es requerido');
    }
    
    if (!datosPropiedad.rentero_id) {
      throw new Error('El campo rentero_id es requerido');
    }
    
    if (!datosPropiedad.ubicacion) {
      throw new Error('El campo ubicacion es requerido');
    }
    const resultado = await PropiedadService.registrarPropiedad(
      req.file.path,
      tipo_id,
      datosPropiedad
    );
    
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
};

export const actualizarPropiedad = async (req, res, next) => {
  try {
    const { propiedadId } = req.params;
    const renteroId = req.usuario.id; 
    const datosActualizacion = req.body;

    if (!propiedadId || isNaN(propiedadId)) {
      return res.status(400).json({
        success: false,
        mensaje: 'ID de propiedad inválido'
      });
    }

    const resultado = await PropiedadService.actualizarPropiedad(
      propiedadId,
      datosActualizacion,
      renteroId
    );

    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};

export const eliminarPropiedad = async (req, res, next) => {
  try {
    const { propiedadId } = req.params;
    const renteroId = req.usuario.id;

    const resultado = await PropiedadService.eliminarPropiedad(propiedadId, renteroId);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};

export const obtenerPropiedadesDelRentero = async (req, res, next) => {
  try {
    const renteroId = req.usuario.id; // Del middleware de autenticación
    const resultado = await PropiedadService.obtenerPropiedadesPorRentero(renteroId);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};

export const registrarUnidad = async (req, res, next) => {
  try {
    const renteroId = req.usuario.id; // Del middleware de autenticación
    const datosUnidad = req.body;

    // Validaciones básicas
    if (!datosUnidad.propiedad_id) {
      throw new Error('El campo propiedad_id es requerido');
    }
    
    if (!datosUnidad.nombre) {
      throw new Error('El campo nombre es requerido');
    }
    
    if (!datosUnidad.precio) {
      throw new Error('El campo precio es requerido');
    }

    const resultado = await PropiedadService.registrarUnidad(datosUnidad, renteroId);
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
};

export const obtenerUnidadesPorPropiedad = async (req, res, next) => {
  try {
    const { propiedadId } = req.params;
    const renteroId = req.usuario.id;
    
    const resultado = await PropiedadService.obtenerUnidadesPorPropiedad(propiedadId, renteroId);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};

export const actualizarUnidad = async (req, res, next) => {
  try {
    const { unidadId } = req.params;
    const renteroId = req.usuario.id;
    const datosActualizacion = req.body;

    const resultado = await PropiedadService.actualizarUnidad(unidadId, datosActualizacion, renteroId);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};

export const eliminarUnidad = async (req, res, next) => {
  try {
    const { unidadId } = req.params;
    const renteroId = req.usuario.id;

    const resultado = await PropiedadService.eliminarUnidad(unidadId, renteroId);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};

export const obtenerUnidadPorId = async (req, res, next) => {
  try {
    const { unidadId } = req.params;
    const renteroId = req.usuario.id;
    
    // Validar que el ID de unidad sea válido
    if (!unidadId || isNaN(unidadId)) {
      return res.status(400).json({
        success: false,
        mensaje: 'ID de unidad inválido'
      });
    }

    const resultado = await PropiedadService.obtenerUnidadPorId(unidadId, renteroId);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};