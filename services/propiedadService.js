import Propiedad from "../models/propiedad.js";
import Unidad from "../models/unidad.js";
import Rentero from "../models/rentero.js";
import Universidad from "../models/universidad.js";

import sequelize from "../config/baseDeDatos.js";
import * as documentoService from "./documentoService.js";

import { Op, fn, col, where } from "sequelize";

import { limpiarArchivoTemporal } from "../utils/files/manejadorArchivos.js";
import {
  ErrorBaseDatos,
  ErrorDocumento,
} from "../utils/errores/erroresDocumento.js";
import { ErrorAplicacion } from "../utils/errores/appError.js";

class PropiedadService {
  async obtenerTodasLasPropiedades() {
    try {
      const unidades = await Unidad.findAll({
        where: { estado: "libre" },
      });

      const propiedadesFormateadas = [];

      for (const unidad of unidades) {
        // Obtener la propiedad manualmente
        const propiedad = await Propiedad.findOne({
          where: {
            id: unidad.propiedad_id,
            visible: true,
          },
        });

        if (!propiedad) continue;

        // Obtener el rentero manualmente
        const rentero = await Rentero.findOne({
          where: { id: propiedad.rentero_id },
          attributes: ["id", "nombre", "apellido", "telefono", "email"],
        });

        if (!rentero) continue;

        const uniJSON = unidad.toJSON();
        const propJSON = propiedad.toJSON();
        const renteroJSON = rentero.toJSON();

        propiedadesFormateadas.push({
          id: uniJSON.id,
          nombre: uniJSON.nombre,
          precio: parseFloat(uniJSON.precio),
          estado: uniJSON.estado,
          descripcion: uniJSON.descripcion,
          imagenes: uniJSON.imagenes,
          ubicacion: {
            nombre: propJSON.nombre,
            direccion: `${propJSON.calle} ${propJSON.numero}, ${propJSON.colonia}`,
            calle: propJSON.calle,
            colonia: propJSON.colonia,
            numero: propJSON.numero,
            codigo_postal: propJSON.codigo_postal,
            municipio: propJSON.municipio,
            estado: propJSON.estado,
            coordenadas: propJSON.ubicacion,
          },
          rentero: {
            id: renteroJSON.id,
            nombre: `${renteroJSON.nombre} ${renteroJSON.apellido}`,
            telefono: renteroJSON.telefono,
            email: renteroJSON.email,
          },
        });
      }

      return {
        success: true,
        cantidad: propiedadesFormateadas.length,
        data: propiedadesFormateadas,
      };
    } catch (error) {
      throw new Error(
        `Error en servicio al obtener propiedades: ${error.message}`
      );
    }
  }

  /**
   * Obtiene una propiedad específica por ID
   * @param {number} id - ID de la unidad
   * @returns {Promise<Object>} Resultado con propiedad formateada
   */
  async obtenerPropiedadPorId(id) {
    if (isNaN(id)) {
      throw new ErrorAplicacion("ID inválido", 400);
    }

    try {
      const unidad = await Unidad.findOne({
        where: {
          id: id,
          estado: "libre",
        },
      });

      if (!unidad) {
        throw new ErrorAplicacion("Propiedad no encontrada", 404);
      }

      // Obtener la propiedad manualmente
      const propiedad = await Propiedad.findOne({
        where: {
          id: unidad.propiedad_id,
          visible: true,
        },
      });

      if (!propiedad) {
        throw new ErrorAplicacion("Propiedad no encontrada", 404);
      }

      // Obtener el rentero manualmente
      const rentero = await Rentero.findOne({
        where: { id: propiedad.rentero_id },
        attributes: ["id", "nombre", "apellido", "telefono", "email"],
      });

      if (!rentero) {
        throw new ErrorAplicacion("Rentero no encontrado", 404);
      }

      const uniJSON = unidad.toJSON();
      const propJSON = propiedad.toJSON();
      const renteroJSON = rentero.toJSON();

      const propiedadFormateada = {
        id: uniJSON.id,
        nombre: uniJSON.nombre,
        precio: parseFloat(uniJSON.precio),
        estado: uniJSON.estado,
        descripcion: uniJSON.descripcion,
        imagenes: uniJSON.imagenes,
        ubicacion: {
          nombre: propJSON.nombre,
          direccion: `${propJSON.calle} ${propJSON.numero}, ${propJSON.colonia}`,
          calle: propJSON.calle,
          colonia: propJSON.colonia,
          numero: propJSON.numero,
          municipio: propJSON.municipio,
          estado: propJSON.estado,
          codigo_postal: propJSON.codigo_postal,
          coordenadas: propJSON.ubicacion,
        },
        rentero: {
          id: renteroJSON.id,
          nombre: `${renteroJSON.nombre} ${renteroJSON.apellido}`,
          telefono: renteroJSON.telefono,
          email: renteroJSON.email,
        },
      };

      return {
        success: true,
        data: propiedadFormateada,
      };
    } catch (error) {
      throw new Error(
        `Error en servicio al obtener propiedad: ${error.message}`
      );
    }
  }

  /**
   * Busca propiedades con filtros específicos
   * @param {Object} filtros - Filtros de búsqueda
   * @returns {Promise<Object>} Resultado con propiedades filtradas
   */
  async buscarPropiedadesConFiltros(filtros) {
    try {
      const {
        precioMin,
        precioMax,
        colonia,
        municipio,
        universidadId,
        universidadNombre,
        rangoKm,
      } = filtros;

      const whereUnidad = { estado: "libre" };
      const wherePropiedad = { visible: true };

      if (precioMin || precioMax) {
        whereUnidad.precio = {};
        if (precioMin) whereUnidad.precio[Op.gte] = precioMin;
        if (precioMax) whereUnidad.precio[Op.lte] = precioMax;
      }

      if (municipio) {
        wherePropiedad.municipio = { [Op.iLike]: `%${municipio}%` };
      }
      if (colonia) {
        wherePropiedad.colonia = { [Op.iLike]: `%${colonia}%` };
      }

      // Obtener unidades con filtros de precio
      const unidades = await Unidad.findAll({
        where: whereUnidad,
        order: [["id", "DESC"]],
      });

      const propiedadesFormateadas = [];

      for (const unidad of unidades) {
        // Obtener la propiedad con filtros de ubicación
        const propiedad = await Propiedad.findOne({
          where: {
            id: unidad.propiedad_id,
            ...wherePropiedad,
          },
        });

        if (!propiedad) continue;

        // Si hay filtros de universidad, verificar distancia
        if ((universidadId || universidadNombre) && rangoKm) {
          const uni = await Universidad.findOne({
            where: universidadId
              ? { id: universidadId }
              : { nombre: { [Op.iLike]: `%${universidadNombre}%` } },
            attributes: ["id", "nombre", "ubicacion"],
          });

          if (uni && propiedad.ubicacion) {
            const [lng, lat] = uni.ubicacion.coordinates;
            const rangoMetros = Number(rangoKm) * 1000;

            // Verificar distancia usando consulta SQL
            const distanceQuery = await sequelize.query(
              `
              SELECT ST_DWithin(
                ST_SetSRID(ST_MakePoint(:propLng, :propLat), 4326),
                ST_SetSRID(ST_MakePoint(:uniLng, :uniLat), 4326),
                :range
              ) as within_range
            `,
              {
                replacements: {
                  propLng: propiedad.ubicacion.coordinates[0],
                  propLat: propiedad.ubicacion.coordinates[1],
                  uniLng: lng,
                  uniLat: lat,
                  range: rangoMetros,
                },
                type: sequelize.QueryTypes.SELECT,
              }
            );

            if (!distanceQuery[0].within_range) continue;
          }
        }

        // Obtener el rentero
        const rentero = await Rentero.findOne({
          where: { id: propiedad.rentero_id },
          attributes: ["id", "nombre", "apellido", "telefono", "email"],
        });

        if (!rentero) continue;

        const uniJSON = unidad.toJSON();
        const propJSON = propiedad.toJSON();
        const renteroJSON = rentero.toJSON();

        propiedadesFormateadas.push({
          id: uniJSON.id,
          nombre: uniJSON.nombre,
          precio: parseFloat(uniJSON.precio),
          estado: uniJSON.estado,
          descripcion: uniJSON.descripcion,
          imagenes: uniJSON.imagenes,
          ubicacion: {
            nombre: propJSON.nombre,
            direccion: `${propJSON.calle} ${propJSON.numero}, ${propJSON.colonia}`,
            calle: propJSON.calle,
            colonia: propJSON.colonia,
            numero: propJSON.numero,
            codigo_postal: propJSON.codigo_postal,
            municipio: propJSON.municipio,
            estado: propJSON.estado,
            coordenadas: propJSON.ubicacion,
          },
          rentero: {
            id: renteroJSON.id,
            nombre: `${renteroJSON.nombre} ${renteroJSON.apellido}`,
            telefono: renteroJSON.telefono,
            email: renteroJSON.email,
          },
        });
      }

      return {
        success: true,
        cantidad: propiedadesFormateadas.length,
        filtros: filtros,
        data: propiedadesFormateadas,
      };
    } catch (error) {
      throw new Error(
        `Error en servicio al filtrar propiedades: ${error.message}`
      );
    }
  }

  async registrarPropiedad(rutaDocumento, tipo_id, datosPropiedad) {
    if (!rutaDocumento) {
      throw new ErrorDocumento("Debe proporcionar un documento válido");
    }

    const transaccion = await sequelize.transaction();

    try {
      const nuevaPropiedad = await crearPropiedad(datosPropiedad, transaccion);

      const { rutaFinal } = await documentoService.procesarDocumento(
        rutaDocumento,
        tipo_id
      );

      const nuevoDocumento = await documentoService.guardarDocumento(
        rutaFinal,
        tipo_id,
        null,
        nuevaPropiedad.id,
        transaccion
      );

      await transaccion.commit();

      return {
        exito: true,
        mensaje: "Propiedad creada exitosamente",
        datos: { propiedad: nuevaPropiedad, documento: nuevoDocumento },
      };
    } catch (error) {
      await transaccion.rollback();
      limpiarArchivoTemporal(rutaDocumento);
      throw manejarErrorRegistro(error);
    }
  }

  async actualizarPropiedad(propiedadId, datosActualizacion, renteroId) {
    const transaccion = await sequelize.transaction();

    try {
      const propiedad = await Propiedad.findOne({
        where: { id: propiedadId, rentero_id: renteroId },
        transaction: transaccion,
      });

      if (!propiedad) {
        throw new ErrorAplicacion(
          "La propiedad no existe o no te pertenece",
          403
        );
      }

      const datosPermitidos = {};

      if (datosActualizacion.nombre !== undefined) {
        const nombre = String(datosActualizacion.nombre).trim();
        if (!nombre)
          throw new ErrorAplicacion("El nombre no puede estar vacío", 400);
        datosPermitidos.nombre = nombre;
      }

      if (datosActualizacion.visible !== undefined) {
        datosPermitidos.visible = Boolean(datosActualizacion.visible);
      }

      if (datosActualizacion.calle !== undefined)
        datosPermitidos.calle = datosActualizacion.calle;
      if (datosActualizacion.colonia !== undefined)
        datosPermitidos.colonia = datosActualizacion.colonia;
      if (datosActualizacion.numero !== undefined)
        datosPermitidos.numero = datosActualizacion.numero;
      if (datosActualizacion.codigo_postal !== undefined)
        datosPermitidos.codigo_postal = datosActualizacion.codigo_postal;
      if (datosActualizacion.municipio !== undefined)
        datosPermitidos.municipio = datosActualizacion.municipio || null;
      if (datosActualizacion.estado !== undefined)
        datosPermitidos.estado = datosActualizacion.estado || null;

      if (datosActualizacion.ubicacion !== undefined) {
        const u = datosActualizacion.ubicacion;
        if (u && (u.coordinates || u.coordenadas?.coordinates)) {
          const coords = Array.isArray(u.coordinates)
            ? u.coordinates
            : u.coordenadas?.coordinates;

          if (
            !Array.isArray(coords) ||
            coords.length !== 2 ||
            coords.some((v) => Number.isNaN(parseFloat(v)))
          ) {
            throw new ErrorAplicacion(
              "Coordenadas inválidas. Se requiere [lng, lat]",
              400
            );
          }

          datosPermitidos.ubicacion = {
            type: "Point",
            coordinates: [parseFloat(coords[0]), parseFloat(coords[1])],
          };
        } else if (u === null) {
          datosPermitidos.ubicacion = null;
        }

        if (u?.calle !== undefined) datosPermitidos.calle = u.calle;
        if (u?.colonia !== undefined) datosPermitidos.colonia = u.colonia;
        if (u?.numero !== undefined) datosPermitidos.numero = u.numero;
        if (u?.codigo_postal !== undefined)
          datosPermitidos.codigo_postal = u.codigo_postal;
        if (u?.municipio !== undefined)
          datosPermitidos.municipio = u.municipio || null;
        if (u?.estado !== undefined) datosPermitidos.estado = u.estado || null;
      }

      await propiedad.update(datosPermitidos, { transaction: transaccion });

      await transaccion.commit();

      return {
        success: true,
        mensaje: "Propiedad actualizada exitosamente",
        data: propiedad,
      };
    } catch (error) {
      await transaccion.rollback();
      throw manejarErrorRegistro(error);
    }
  }


  async eliminarPropiedad(propiedadId, renteroId) {
    try {
      const propiedad = await Propiedad.findOne({
        where: {
          id: propiedadId,
          rentero_id: renteroId
        }
      });

      if (!propiedad) {
        throw new ErrorAplicacion('La propiedad no existe o no te pertenece', 403);
      }

      await propiedad.destroy();

      return {
        success: true,
        mensaje: 'Propiedad eliminada exitosamente'
      };
    } catch (error) {
      throw error;
    }
  }


  /**
   * Obtiene todas las propiedades de un rentero específico
   * @param {number} renteroId - ID del rentero
   * @returns {Promise<Object>} Lista de propiedades del rentero
   */
  async obtenerPropiedadesPorRentero(renteroId) {
    try {
      const propiedades = await Propiedad.findAll({
        where: {
          rentero_id: renteroId,
          visible: true,
        },
        attributes: ['id', 'nombre', 'calle', 'colonia', 'numero', 'codigo_postal', 'municipio', 'estado', 'visible'],
        order: [["id", "DESC"]],
      });

      return {
        success: true,
        cantidad: propiedades.length,
        data: propiedades,
      };
    } catch (error) {
      throw new Error(
        `Error al obtener propiedades del rentero: ${error.message}`
      );
    }
  }

  /**
   * Obtiene todas las unidades de una propiedad específica
   * @param {number} propiedadId - ID de la propiedad
   * @param {number} renteroId - ID del rentero autenticado
   * @returns {Promise<Object>} Lista de unidades
   */
  async obtenerUnidadesPorPropiedad(propiedadId, renteroId) {
    try {
      // Verificar que la propiedad pertenezca al rentero
      const propiedad = await Propiedad.findOne({
        where: {
          id: propiedadId,
          rentero_id: renteroId,
        },
      });

      if (!propiedad) {
        throw new ErrorAplicacion(
          "La propiedad no existe o no te pertenece",
          403
        );
      }

      const unidades = await Unidad.findAll({
        where: { propiedad_id: propiedadId },
        order: [["id", "DESC"]],
      });

      return {
        success: true,
        cantidad: unidades.length,
        propiedad: {
          id: propiedad.id,
          nombre: propiedad.nombre,
        },
        data: unidades,
      };
    } catch (error) {
      throw new Error(`Error al obtener unidades: ${error.message}`);
    }
  }

  async obtenerUnidadPorId(unidadId, renteroId = null) {
    if (isNaN(unidadId)) {
      throw new ErrorAplicacion("ID de unidad inválido", 400);
    }

    try {
      // Buscar la unidad
      const unidad = await Unidad.findOne({
        where: { id: unidadId },
      });

      if (!unidad) {
        throw new ErrorAplicacion("Unidad no encontrada", 404);
      }

      // Obtener la propiedad relacionada
      const propiedad = await Propiedad.findOne({
        where: { id: unidad.propiedad_id },
      });

      if (!propiedad) {
        throw new ErrorAplicacion("Propiedad relacionada no encontrada", 404);
      }

      // Si se proporciona renteroId, verificar que la propiedad pertenezca al rentero
      if (renteroId && propiedad.rentero_id !== renteroId) {
        throw new ErrorAplicacion(
          "No tienes permisos para ver esta unidad",
          403
        );
      }

      // Obtener el rentero
      const rentero = await Rentero.findOne({
        where: { id: propiedad.rentero_id },
        attributes: ["id", "nombre", "apellido", "telefono", "email"],
      });

      if (!rentero) {
        throw new ErrorAplicacion("Rentero no encontrado", 404);
      }

      // Formatear la respuesta
      const uniJSON = unidad.toJSON();
      const propJSON = propiedad.toJSON();
      const renteroJSON = rentero.toJSON();

      const unidadFormateada = {
        id: uniJSON.id,
        nombre: uniJSON.nombre,
        precio: parseFloat(uniJSON.precio),
        estado: uniJSON.estado,
        descripcion: uniJSON.descripcion,
        imagenes: uniJSON.imagenes,
        propiedad_id: uniJSON.propiedad_id,
        ubicacion: {
          nombre: propJSON.nombre,
          direccion: `${propJSON.calle} ${propJSON.numero}, ${propJSON.colonia}`,
          calle: propJSON.calle,
          colonia: propJSON.colonia,
          numero: propJSON.numero,
          codigo_postal: propJSON.codigo_postal,
          municipio: propJSON.municipio,
          estado: propJSON.estado,
          coordenadas: propJSON.ubicacion,
        },
        rentero: {
          id: renteroJSON.id,
          nombre: `${renteroJSON.nombre} ${renteroJSON.apellido}`,
          telefono: renteroJSON.telefono,
          email: renteroJSON.email,
        },
      };

      return {
        success: true,
        data: unidadFormateada,
      };
    } catch (error) {
      if (error instanceof ErrorAplicacion) {
        throw error;
      }
      throw new Error(`Error en servicio al obtener unidad: ${error.message}`);
    }
  }

  /**
   * Actualiza una unidad específica
   * @param {number} unidadId - ID de la unidad
   * @param {Object} datosActualizacion - Datos a actualizar
   * @param {number} renteroId - ID del rentero autenticado
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async actualizarUnidad(unidadId, datosActualizacion, renteroId) {
    const transaccion = await sequelize.transaction();

    try {
      // Buscar la unidad
      const unidad = await Unidad.findOne({
        where: { id: unidadId },
        transaction: transaccion,
      });

      if (!unidad) {
        throw new ErrorAplicacion("La unidad no existe", 404);
      }

      // Verificar que la propiedad pertenezca al rentero
      const propiedad = await Propiedad.findOne({
        where: {
          id: unidad.propiedad_id,
          rentero_id: renteroId,
        },
        transaction: transaccion,
      });

      if (!propiedad) {
        throw new ErrorAplicacion(
          "No tienes permisos para actualizar esta unidad",
          403
        );
      }

      // Preparar datos para actualización
      const datosPermitidos = {};
      if (datosActualizacion.nombre)
        datosPermitidos.nombre = datosActualizacion.nombre;
      if (datosActualizacion.precio) {
        const precio = parseFloat(datosActualizacion.precio);
        if (isNaN(precio) || precio <= 0) {
          throw new ErrorAplicacion(
            "El precio debe ser un número válido mayor a 0",
            400
          );
        }
        datosPermitidos.precio = precio;
      }
      if (datosActualizacion.estado)
        datosPermitidos.estado = datosActualizacion.estado;
      if (datosActualizacion.descripcion !== undefined)
        datosPermitidos.descripcion = datosActualizacion.descripcion;
      if (datosActualizacion.imagenes !== undefined)
        datosPermitidos.imagenes = datosActualizacion.imagenes;

      await unidad.update(datosPermitidos, { transaction: transaccion });

      await transaccion.commit();

      return {
        success: true,
        mensaje: "Unidad actualizada exitosamente",
        data: unidad,
      };
    } catch (error) {
      await transaccion.rollback();
      throw manejarErrorRegistro(error);
    }
  }

  /**
   * Registra una nueva unidad en la base de datos
   * @param {Object} datosUnidad - Datos de la unidad a registrar
   * @param {number} renteroId - ID del rentero autenticado
   * @returns {Promise<Object>} Resultado del registro
   */
  async registrarUnidad(datosUnidad, renteroId) {
    const transaccion = await sequelize.transaction();

    try {
      // Verificar que la propiedad existe y pertenece al rentero autenticado
      const propiedad = await Propiedad.findOne({
        where: {
          id: datosUnidad.propiedad_id,
          rentero_id: renteroId,
        },
        transaction: transaccion,
      });

      if (!propiedad) {
        throw new ErrorAplicacion(
          "La propiedad no existe o no te pertenece",
          403
        );
      }

      // Preparar datos para la unidad
      const unidadData = {
        propiedad_id: datosUnidad.propiedad_id,
        nombre: datosUnidad.nombre.trim(),
        precio: parseFloat(datosUnidad.precio),
        estado: datosUnidad.estado || "libre",
        descripcion: datosUnidad.descripcion || null,
        imagenes: datosUnidad.imagenes || null,
      };

      // Crear la unidad
      const nuevaUnidad = await Unidad.create(unidadData, {
        transaction: transaccion,
      });

      await transaccion.commit();

      return {
        success: true,
        mensaje: "Unidad registrada exitosamente",
        data: nuevaUnidad,
      };
    } catch (error) {
      await transaccion.rollback();
      throw manejarErrorRegistro(error);
    }
  }

  /**
   * Elimina una unidad completamente de la base de datos (HARD DELETE)
   * @param {number} unidadId - ID de la unidad
   * @param {number} renteroId - ID del rentero autenticado
   * @returns {Promise<Object>} Resultado de la eliminación
   */
  async eliminarUnidad(unidadId, renteroId) {
    const transaccion = await sequelize.transaction();

    try {
      // 1. Buscar la unidad
      const unidad = await Unidad.findOne({
        where: { id: unidadId },
        transaction: transaccion,
      });

      if (!unidad) {
        throw new ErrorAplicacion("La unidad no existe", 404);
      }

      // 2. Verificar que la propiedad pertenezca al rentero
      const propiedad = await Propiedad.findOne({
        where: {
          id: unidad.propiedad_id,
          rentero_id: renteroId,
        },
        transaction: transaccion,
      });

      if (!propiedad) {
        throw new ErrorAplicacion(
          "No tienes permisos para eliminar esta unidad",
          403
        );
      }

      // 3. (Opcional) Verificar si la unidad está ocupada
      if (unidad.estado === "ocupada") {
        throw new ErrorAplicacion(
          "No se puede eliminar una unidad que está ocupada",
          400
        );
      }

      // 4. Eliminar completamente la unidad
      const resultado = await Unidad.destroy({
        where: { id: unidadId },
        transaction: transaccion,
      });

      await transaccion.commit();

      if (resultado > 0) {
        return {
          success: true,
          mensaje: "Unidad eliminada exitosamente",
          unidadId: unidadId,
        };
      } else {
        throw new ErrorAplicacion("No se pudo eliminar la unidad", 500);
      }
    } catch (error) {
      await transaccion.rollback();
      throw manejarErrorRegistro(error);
    }
  }
}

const crearPropiedad = async (datosPropiedad, transaccion) => {
  const { ubicacion, ...restoPropiedad } = datosPropiedad;

  let datosParaBD = { ...restoPropiedad };

  const coordenadas = ubicacion.coordenadas?.coordinates;

  datosParaBD = {
    ...restoPropiedad,
    calle: ubicacion.calle,
    colonia: ubicacion.colonia,
    numero: ubicacion.numero,
    codigo_postal: ubicacion.codigo_postal,
    municipio: ubicacion.municipio || null,
    estado: ubicacion.estado || null,

    ubicacion:
      coordenadas && coordenadas.length === 2
        ? {
          type: "Point",
          coordinates: coordenadas,
        }
        : null,
  };

  return await Propiedad.create(datosParaBD, { transaction: transaccion });
};

const manejarErrorRegistro = (error) => {
  if (error.name === "SequelizeValidationError") {
    const mensajesError = error.errors.map((e) => e.message).join(", ");
    return new ErrorBaseDatos(`Error de validación: ${mensajesError}`);
  }

  return error;
};

export default new PropiedadService();
