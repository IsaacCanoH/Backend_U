import { ErrorValidacionDocumento } from "../errores/erroresDocumento.js";
import { ResultadoValidacion } from "./resultadoValidacion.js";

/**
 * Clase responsable de la validación de campos y lógica de negocio
 * para documentos, incluyendo similitud de nombres y cálculo de porcentajes
 */
export class ServicioValidadorDocumento {
  /**
   * @param {Object} config - Configuración del servicio
   * @param {number} config.umbralSimilitudNombre - Umbral de similitud para nombres (default: 0.9)
   * @param {number} config.umbralInvalido - Umbral para documento inválido (default: 40)
   * @param {number} config.umbralParcial - Umbral para documento parcial (default: 70)
   */
  constructor(config = {}) {
    this.configuracion = {
      umbralSimilitudNombre: config.umbralSimilitudNombre || 0.9,
      umbralInvalido: config.umbralInvalido || 40,
      umbralParcial: config.umbralParcial || 70
    };
  }

  /**
   * Valida los datos extraídos de un documento según su tipo
   * @param {string} textoExtraido - Texto extraído por OCR
   * @param {number} tipoId - ID del tipo de documento
   * @param {Object} opcionesValidacion - Opciones adicionales de validación
   * @param {string} opcionesValidacion.nombreFormulario - Nombre para validar similitud (opcional)
   * @returns {Promise<ResultadoValidacion>} - Resultado de la validación
   */
  async validarCampos(textoExtraido, tipoId, opcionesValidacion = {}) {
    const textoMayus = textoExtraido.toUpperCase();
    const tipoDocumento = await this._obtenerTipoDocumentoPorID(tipoId);

    if (!tipoDocumento) {
      throw new ErrorValidacionDocumento(`Tipo de documento no válido: ${tipoId}`);
    }

    // Calcular campos presentes y faltantes
    const camposFaltantes = tipoDocumento.campos_requeridos.filter(
      campo => !textoMayus.includes(campo.toUpperCase())
    );

    const total = tipoDocumento.campos_requeridos.length;
    const faltan = camposFaltantes.length;
    const camposPresentes = total - faltan;
    const porcentaje = total > 0 ? (camposPresentes / total) * 100 : 100;

    // JERARQUÍA DE ERRORES - Se evalúan en orden de prioridad

    // Error 1 (PRIORIDAD MÁXIMA): Documento inválido (< 40% de campos válidos)
    if (porcentaje < this.configuracion.umbralInvalido) {
      return ResultadoValidacion.crearInvalido(porcentaje, camposFaltantes, total);
    }

    // Error 2: Validación de nombre (solo para documentos de identidad con >= 15% campos válidos)
    if (Number(tipoId) === 1 && opcionesValidacion.nombreFormulario) {
      const similitud = this.calcularSimilitudNombre(textoExtraido, opcionesValidacion.nombreFormulario);

      if (similitud < this.configuracion.umbralSimilitudNombre) {
        return ResultadoValidacion.crearNombreNoCoincide(
          porcentaje, 
          similitud, 
          opcionesValidacion.nombreFormulario, 
          total, 
          camposFaltantes
        );
      }
    }

    // Error 3: Documento parcial (40-70% de campos válidos)
    if (porcentaje >= this.configuracion.umbralInvalido && porcentaje < this.configuracion.umbralParcial) {
      return ResultadoValidacion.crearParcial(porcentaje, camposFaltantes, total);
    }

    // Si llegamos aquí, el documento es válido (>= 70% de campos válidos)
    return ResultadoValidacion.crearValido(porcentaje, total);
  }

  /**
   * Calcula la similitud entre dos nombres usando algoritmo de distancia de Levenshtein
   * @param {string} textoDocumento - Texto extraído del documento
   * @param {string} nombreFormulario - Nombre del formulario
   * @returns {number} - Porcentaje de similitud (0-1)
   */
  calcularSimilitudNombre(textoDocumento, nombreFormulario) {
    const textoNormalizado = this.normalizarTexto(textoDocumento);
    const nombreNormalizado = this.normalizarTexto(nombreFormulario);

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
        const similitudActual = this._similitudToken(tokenFormulario, tokenDocumento);
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
  }

  /**
   * Normaliza una cadena de texto para comparación
   * @param {string} texto - Texto a normalizar
   * @returns {string} - Texto normalizado
   */
  normalizarTexto(texto) {
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
  }

  /**
   * Calcula la similitud entre dos tokens usando distancia de Levenshtein
   * @param {string} tokenA - Primer token
   * @param {string} tokenB - Segundo token
   * @returns {number} - Similitud (0-1)
   * @private
   */
  _similitudToken(tokenA, tokenB) {
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
  }

  /**
   * Obtiene información de un tipo de documento por su ID
   * @param {number} id - ID del tipo de documento
   * @returns {Promise<Object|null>} - Tipo de documento o null
   * @private
   */
  async _obtenerTipoDocumentoPorID(id) {
    // Importación dinámica para evitar dependencias circulares
    const { obtenerTipoDocumentoPorID } = await import("../../services/documentoService.js");
    return await obtenerTipoDocumentoPorID(id);
  }

  /**
   * Valida si un porcentaje corresponde a un documento válido
   * @param {number} porcentaje - Porcentaje de reconocimiento
   * @returns {boolean}
   */
  esDocumentoValido(porcentaje) {
    return porcentaje >= this.configuracion.umbralParcial;
  }

  /**
   * Valida si un porcentaje corresponde a un documento parcial
   * @param {number} porcentaje - Porcentaje de reconocimiento
   * @returns {boolean}
   */
  esDocumentoParcial(porcentaje) {
    return porcentaje >= this.configuracion.umbralInvalido && 
           porcentaje < this.configuracion.umbralParcial;
  }

  /**
   * Valida si un porcentaje corresponde a un documento inválido
   * @param {number} porcentaje - Porcentaje de reconocimiento
   * @returns {boolean}
   */
  esDocumentoInvalido(porcentaje) {
    return porcentaje < this.configuracion.umbralInvalido;
  }

  /**
   * Determina el tipo de validación basado en el porcentaje
   * @param {number} porcentaje - Porcentaje de reconocimiento
   * @returns {string} - Tipo de validación
   */
  determinarTipoValidacion(porcentaje) {
    return ResultadoValidacion.determinarTipoValidacion(porcentaje);
  }

  /**
   * Calcula estadísticas de validación para un conjunto de resultados
   * @param {ResultadoValidacion[]} resultados - Array de resultados
   * @returns {Object} - Estadísticas
   */
  calcularEstadisticas(resultados) {
    if (!Array.isArray(resultados) || resultados.length === 0) {
      return {
        total: 0,
        validos: 0,
        parciales: 0,
        invalidos: 0,
        porcentajeValidos: 0,
        porcentajeParciales: 0,
        porcentajeInvalidos: 0,
        porcentajePromedio: 0
      };
    }

    const validos = resultados.filter(r => r.esValido).length;
    const parciales = resultados.filter(r => r.tipoValidacion === 'PARCIAL').length;
    const invalidos = resultados.filter(r => r.tipoValidacion === 'INVALIDO').length;
    const total = resultados.length;

    const porcentajePromedio = resultados.reduce((sum, r) => sum + r.porcentaje, 0) / total;

    return {
      total,
      validos,
      parciales,
      invalidos,
      porcentajeValidos: (validos / total * 100).toFixed(2),
      porcentajeParciales: (parciales / total * 100).toFixed(2),
      porcentajeInvalidos: (invalidos / total * 100).toFixed(2),
      porcentajePromedio: porcentajePromedio.toFixed(2)
    };
  }

  /**
   * Actualiza la configuración del servicio
   * @param {Object} nuevaConfig - Nueva configuración
   */
  actualizarConfiguracion(nuevaConfig) {
    this.configuracion = { ...this.configuracion, ...nuevaConfig };
  }

  /**
   * Obtiene la configuración actual
   * @returns {Object} - Configuración actual
   */
  obtenerConfiguracion() {
    return { ...this.configuracion };
  }

  /**
   * Valida si un texto tiene contenido significativo
   * @param {string} texto - Texto a validar
   * @returns {boolean}
   */
  tieneContenidoSignificativo(texto) {
    if (!texto || typeof texto !== 'string') {
      return false;
    }

    const textoNormalizado = this.normalizarTexto(texto);
    const palabras = textoNormalizado.split(' ').filter(palabra => palabra.length > 2);
    
    return palabras.length >= 3; // Requiere al menos 3 palabras significativas
  }

  /**
   * Extrae palabras clave de un texto
   * @param {string} texto - Texto de origen
   * @param {number} maxPalabras - Máximo de palabras a extraer
   * @returns {string[]} - Palabras clave
   */
  extraerPalabrasClave(texto, maxPalabras = 10) {
    const textoNormalizado = this.normalizarTexto(texto);
    const palabras = textoNormalizado.split(' ')
      .filter(palabra => palabra.length > 2)
      .slice(0, maxPalabras);
    
    return [...new Set(palabras)]; // Eliminar duplicados
  }
}
