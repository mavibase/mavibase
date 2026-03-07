export * from '@mavibase/database';
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
//# sourceMappingURL=index.d.ts.map