import { ErrorCategory } from '../utils/error-handler';

export interface ExtendedError extends Error {
  category?: ErrorCategory;
  code?: string;
  details?: Record<string, unknown>;
}

export interface LoggedError {
  message: string;
  name: string;
  stack?: string;
  category?: ErrorCategory;
  code?: string;
  details?: Record<string, unknown>;
}

export interface FacebookApiError extends Error {
  error: number | string;
  errorSummary?: string;
  errorDescription?: string;
}

export interface ApiError extends Error {
  code: string; 
  statusCode?: number;
  details?: Record<string, unknown>;
}

export function formatError(error: Error | ExtendedError): LoggedError {
  const loggedError: LoggedError = {
    message: error.message,
    name: error.name,
    stack: error.stack
  };

  if ('category' in error) {
    loggedError.category = error.category;
  }
  
  if ('code' in error) {
    loggedError.code = (error as ExtendedError).code;
  }

  if ('details' in error) {
    loggedError.details = (error as ExtendedError).details;
  }

  return loggedError;
}
