export class ErrorAplicacion extends Error {
  /**
   * @param {string} mensaje - mensaje de error legible para el cliente
   * @param {number} codigoEstado - código HTTP
   */
  constructor(mensaje, codigoEstado = 500) {
    super(mensaje);
    this.codigoEstado = codigoEstado;
    this.errorControlado = true; // indica que es un error que esperamos y controlamos
  }
}
