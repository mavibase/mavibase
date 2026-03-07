// Re-export database types for convenience
export * from '@mavibase/database';

import type { IdentityContext } from '@mavibase/database';

// Extend Express Request with identity
declare global {
  namespace Express {
    interface Request {
      identity?: IdentityContext;
    }
  }
}

// API-specific types
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    stack?: string;
  };
}

export interface SuccessResponse<T = any> {
  success: boolean;
  data?: T;
  meta?: Record<string, any>;
}
