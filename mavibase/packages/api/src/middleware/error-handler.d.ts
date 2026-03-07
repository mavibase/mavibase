import type { Request, Response, NextFunction } from "express";
export declare class AppError extends Error {
    statusCode: number;
    code: string;
    details?: any;
    constructor(statusCode: number, code: string, message: string, details?: any);
}
export declare const errorHandler: (err: Error | AppError, req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
//# sourceMappingURL=error-handler.d.ts.map