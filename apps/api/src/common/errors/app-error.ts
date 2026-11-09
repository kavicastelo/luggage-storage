import { ErrorCode, ApiErrorDetail } from "@luggage-storage/contracts";

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: ApiErrorDetail[];
  public readonly retryAfterSeconds?: number;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode = 400,
    details?: ApiErrorDetail[],
    retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: ApiErrorDetail[]): AppError {
    return new AppError("BAD_REQUEST", message, 400, details);
  }

  static validation(message = "Validation failed", details?: ApiErrorDetail[]): AppError {
    return new AppError("VALIDATION_ERROR", message, 400, details);
  }

  static notFound(message: string): AppError {
    return new AppError("NOT_FOUND", message, 404);
  }

  static conflict(message: string): AppError {
    return new AppError("CONFLICT", message, 409);
  }

  static unauthorized(message = "Authentication required"): AppError {
    return new AppError("UNAUTHORIZED", message, 401);
  }

  static forbidden(message = "Access denied"): AppError {
    return new AppError("FORBIDDEN", message, 403);
  }

  static internal(message = "Internal server error"): AppError {
    return new AppError("INTERNAL_SERVER_ERROR", message, 500);
  }

  static rateLimited(message = "Too many requests", retryAfterSeconds?: number): AppError {
    return new AppError("RATE_LIMITED", message, 429, undefined, retryAfterSeconds);
  }
}
