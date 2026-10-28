import type { NextFunction, Request, Response } from "express";
import { ValidationError as SequelizeValidationError, UniqueConstraintError } from "sequelize";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  let statusCode = 500;
  let message = "Error interno del servidor.";
  let details: unknown;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof UniqueConstraintError) {
    statusCode = 409;
    message = "Ya existe un registro con esos datos.";
    details = err.errors.map((e) => ({ path: e.path, message: e.message }));
  } else if (err instanceof SequelizeValidationError) {
    statusCode = 400;
    message = "Datos inválidos.";
    details = err.errors.map((e) => ({ path: e.path, message: e.message }));
  } else if (err instanceof Error) {
    message = err.message;
  }

  if (statusCode >= 500) {
    console.error("[error]", err);
  }

  res.status(statusCode).json({
    error: {
      message,
      ...(details ? { details } : {}),
      ...(env.isProduction ? {} : { stack: err instanceof Error ? err.stack : undefined }),
    },
  });
}
