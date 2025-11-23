import ocrApi from "./ocrApi.js";
import verificarDatos from "./validadorCamposOCR.js";
import { ErrorDocumento } from "../errores/erroresDocumento.js";

const validarDocumento = async (rutaArchivo, tipo_id, opcionesValidacion = {}) => {
  try {
    const textoExtraido = await ocrApi(rutaArchivo);
    await verificarDatos(textoExtraido, tipo_id, opcionesValidacion);
    return true;
  } catch (error) {
    if (error.errorControlado) {
      throw error;
    }
    throw new ErrorDocumento(`Error al validar el documento: ${error.message}`);
  }
};

export default validarDocumento;
