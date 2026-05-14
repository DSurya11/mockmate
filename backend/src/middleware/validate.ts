import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';

export const validateBody = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

export const validateParams = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
  try {
    req.params = schema.parse(req.params);
    next();
  } catch (error) {
    next(error);
  }
};

export const validateQuery = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
  try {
    req.query = schema.parse(req.query);
    next();
  } catch (error) {
    next(error);
  }
};
