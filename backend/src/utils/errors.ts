// Base error class carrying an HTTP status + client-safe message.
// Controllers/services throw these; the error middleware turns them into the
// { success: false, message } envelope.
export class AppError extends Error {
  public readonly status: number;
  public readonly errors?: Record<string, string[]>;
  // Machine-readable discriminator (e.g. "email_not_verified") so clients can
  // branch on *why* an error happened without string-matching the human
  // message — messages get reworded, codes don't.
  public readonly code?: string;

  constructor(
    status: number,
    message: string,
    errors?: Record<string, string[]>,
    code?: string,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.errors = errors;
    this.code = code;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", errors?: Record<string, string[]>) {
    super(400, message, errors);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(401, message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", code?: string) {
    super(403, message, undefined, code);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(409, message);
    this.name = "ConflictError";
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "File too large") {
    super(413, message);
    this.name = "PayloadTooLargeError";
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message = "Unsupported media type") {
    super(415, message);
    this.name = "UnsupportedMediaTypeError";
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = "Unprocessable entity") {
    super(422, message);
    this.name = "UnprocessableEntityError";
  }
}

export class BadGatewayError extends AppError {
  constructor(message = "Upstream service failure") {
    super(502, message);
    this.name = "BadGatewayError";
  }
}
