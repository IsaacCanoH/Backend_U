import Universidad from "../models/universidad.js";

class UniversidadService {
  async obtenerUniversidadesBasico() {
    try {
      const universidades = await Universidad.findAll({
        attributes: ["id", "nombre", "ubicacion"],
        order: [["id", "DESC"]],
      });

      const data = universidades.map((u) => {
        const item = u.toJSON();
        const coords =
          item.ubicacion && item.ubicacion.coordinates
            ? item.ubicacion.coordinates
            : null;

        return {
          id: item.id,
          nombre: item.nombre,
          coordenadas: coords, 
        };
      });

      return {
        success: true,
        cantidad: data.length,
        data,
      };
    } catch (error) {
      throw new Error(`Error en servicio al obtener universidades: ${error.message}`);
    }
  }
}

export default new UniversidadService();
