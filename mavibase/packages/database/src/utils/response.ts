import { Response } from 'express';

export interface ListResponse<T> {
  items: T[];
  total: number;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export const sendListResponse = <T>(res: Response, data: ListResponse<T>) => {
  return res.json(data);
};

export const sendErrorResponse = (
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: any,
) => {
  const response: ErrorResponse = {
    error: {
      code,
      message,
      details,
    },
  };
  return res.status(statusCode).json(response);
};

export const sendCreated = <T>(res: Response, data: T) => {
  return res.status(201).json(data);
};

export const sendNoContent = (res: Response) => {
  return res.status(204).send();
};
