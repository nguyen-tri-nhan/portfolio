import { Request, Response, NextFunction } from "express";
import logger from "./loggerConfig";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  logger.info(`IP: ${req.ip} METHOD: ${req.method} ORIGINAL_URL: ${req.originalUrl} RESPONSE_STATUS: ${res.statusCode}`);
  next();
}

export function errorLogger(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error(err.stack || err.message);
  next(err);
}
