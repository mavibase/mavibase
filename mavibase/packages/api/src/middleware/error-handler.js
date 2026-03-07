"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.AppError = void 0;
const logger_1 = require("@mavibase/database/utils/logger");
class AppError extends Error {
    constructor(statusCode, code, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.name = "AppError";
    }
}
exports.AppError = AppError;
const errorHandler = (err, req, res, next) => {
    logger_1.logger.error("Error occurred", {
        error: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
        path: req.path,
        method: req.method,
    });
    if (err instanceof AppError) {
        const response = {
            error: {
                code: err.code,
                message: err.message,
                details: err.details,
            },
        };
        return res.status(err.statusCode).json(response);
    }
    // Default error
    const response = {
        error: {
            code: "INTERNAL_SERVER_ERROR",
            message: process.env.NODE_ENV === "production" ? "An unexpected error occurred" : err.message,
        },
    };
    res.status(500).json(response);
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=error-handler.js.map