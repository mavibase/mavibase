/**
 * Application Error class for consistent error handling across packages
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any,
  ) {
    super(message)
    this.name = "AppError"
  }
}
