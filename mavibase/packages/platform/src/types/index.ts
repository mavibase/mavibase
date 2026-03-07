import 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: any;
      clientIp?: string;
      teamId?: string;
      projectId?: string;
      requestId?: string;
    }
  }
}

export {};
