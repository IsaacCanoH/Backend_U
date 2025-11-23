import { ErrorValidacionDocumento } from "../errores/erroresDocumento.js";
import { obtenerTipoDocumentoPorID } from "../../services/documentoService.js";

const normalizarCadena = (texto) => {
  if (!texto) {
    return "";
  }
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const similitudToken = (tokenA, tokenB) => {
  const longitudA = tokenA.length;
  const longitudB = tokenB.length;

  if (longitudA === 0 && longitudB === 0) {
    return 1;
  }

  if (longitudA === 0 || longitudB === 0) {
    return 0;
  }

  const matriz = Array.from({ length: longitudA + 1 }, () => new Array(longitudB + 1).fill(0));

  for (let i = 0; i <= longitudA; i++) {
    matriz[i][0] = i;
  }

  for (let j = 0; j <= longitudB; j++) {
    matriz[0][j] = j;
  }

  for (let i = 1; i <= longitudA; i++) {
    for (let j = 1; j <= longitudB; j++) {
      const costo = tokenA[i - 1] === tokenB[j - 1] ? 0 : 1;
      matriz[i][j] = Math.min(
        matriz[i - 1][j] + 1,
        matriz[i][j - 1] + 1,
        matriz[i - 1][j - 1] + costo
      );
    }
  }

  const distancia = matriz[longitudA][longitudB];
  const longitudMaxima = Math.max(longitudA, longitudB);

  return 1 - distancia / longitudMaxima;
};

const calcularSimilitudNombre = (textoDocumento, nombreFormulario) => {
  const textoNormalizado = normalizarCadena(textoDocumento);
  const nombreNormalizado = normalizarCadena(nombreFormulario);

  if (!textoNormalizado || !nombreNormalizado) {
    return 0;
  }

  const tokensFormulario = nombreNormalizado.split(" ").filter(Boolean);
  const tokensDocumento = textoNormalizado.split(" ").filter(Boolean);

  if (tokensFormulario.length === 0 || tokensDocumento.length === 0) {
    return 0;
  }

  const caracteresTotales = tokensFormulario.reduce((acum, token) => acum + token.length, 0);

  let coincidenciaAcumulada = 0;

  for (const tokenFormulario of tokensFormulario) {
    let similitudMaxima = 0;

    for (const tokenDocumento of tokensDocumento) {
      const similitudActual = similitudToken(tokenFormulario, tokenDocumento);
      if (similitudActual > similitudMaxima) {
        similitudMaxima = similitudActual;
      }
      if (similitudMaxima === 1) {
        break;
      }
    }

    coincidenciaAcumulada += similitudMaxima * tokenFormulario.length;
  }

  return coincidenciaAcumulada / caracteresTotales;
};

const verificarDatos = async (textoExtraido, tipo_id, opcionesValidacion = {}) => {
  const textoMayus = textoExtraido.toUpperCase();
  const tipoDocumento = await obtenerTipoDocumentoPorID(tipo_id);

  if (!tipoDocumento) {
    throw new ErrorValidacionDocumento(`Tipo de documento no válido: ${tipo_id}`);
  }

  const camposFaltantes = tipoDocumento.campos_requeridos.filter(campo => !textoMayus.includes(campo.toUpperCase()));

  const total = tipoDocumento.campos_requeridos.length;
  const faltan = camposFaltantes.length;
  const camposPresentes = total - faltan;
  const porcentaje = total > 0 ? (camposPresentes / total) * 100 : 100;
  const detalle = camposFaltantes.join(', ');

  // JERARQUÍA DE ERRORES - Se evalúan en orden de prioridad

  // Error 1 (PRIORIDAD MÁXIMA): Documento inválido (menos del 50% de campos válidos)
  // Este error tiene prioridad sobre cualquier otro porque indica que el documento no corresponde al tipo esperado (ej: subir recibo de agua en lugar de INE)
  if (porcentaje < 40) {
    throw new ErrorValidacionDocumento(
      `DOCUMENTO_INVALIDO: Faltan ${faltan} campo(s): ${detalle}`,
      'documento_invalido',
      camposFaltantes,
      faltan,
      total
    );
  }

  // Error 2: Validación de nombre (solo para documentos de identidad con >= 15% campos válidos)
  // Solo se valida el nombre si el documento ya pasó la validación básica de tipo
  if (Number(tipo_id) === 1 && opcionesValidacion.nombreFormulario) {
    const similitud = calcularSimilitudNombre(textoExtraido, opcionesValidacion.nombreFormulario);

    if (similitud < 0.9) {
      throw new ErrorValidacionDocumento(
        `NOMBRE_NO_COINCIDE: El nombre del documento no coincide con el documento (similitud ${Math.round(similitud * 100)}%)`,
        'nombre_no_coincide',
        {
          similitud,
          nombreFormulario: opcionesValidacion.nombreFormulario
        },
        null,
        null
      );
    }
  }

  // Error 3: Faltan campos pero el documento tiene entre 40% y 60% válidos
  // El documento es del tipo correcto pero le faltan algunos campos importantes
  if (porcentaje >= 40 && porcentaje < 70) {
    throw new ErrorValidacionDocumento(
      `FALTAN_CAMPOS_AL_DOCUMENTO: Faltan ${faltan} campo(s): ${detalle}`,
      'faltan_campos_al_documento',
      camposFaltantes,
      faltan,
      total
    );
  }

  // Si llegamos aquí, el documento es válido (porcentaje >= 60%)
}

export default verificarDatos;