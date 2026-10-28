/**
 * Error operativo con código HTTP. Lo captura el middleware de errores y lo
 * traduce a una respuesta JSON uniforme.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = "No autenticado.") {
    return new ApiError(401, message);
  }

  static forbidden(message = "No autorizado.") {
    return new ApiError(403, message);
  }

  static notFound(message = "Recurso no encontrado.") {
    return new ApiError(404, message);
  }

  static conflict(message: string) {
    return new ApiError(409, message);
  }
}
