import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { DirectionsRequest } from '../types/direction.types';


export const validateBody = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: error.errors.map(e => ({
                        field: e.path.join('.'),
                        message: e.message
                    }))
                });
            } else {
                res.status(400).json({ error: 'Invalid request body' });
            }
        }
    };
};


export const validateParams = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            req.params = schema.parse(req.params);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({
                    error: 'Invalid parameters',
                    details: error.errors.map(e => ({
                        field: e.path.join('.'),
                        message: e.message
                    }))
                });
            } else {
                res.status(400).json({ error: 'Invalid parameters' });
            }
        }
    };
};

export const validateQuery = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            req.query = schema.parse(req.query);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({
                    error: 'Invalid query parameters',
                    details: error.errors.map(e => ({
                        field: e.path.join('.'),
                        message: e.message
                    }))
                });
            } else {
                res.status(400).json({ error: 'Invalid query parameters' });
            }
        }
    };
};

export const validateDirectionsRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { from, to }: DirectionsRequest = req.body;

  if (!from || !to) {
    res.status(400).json({ 
      error: 'Missing required fields: from and to' 
    });
    return;
  }

  // Validate coordinate structure
  if (!from.lat || !from.lng || !to.lat || !to.lng) {
    res.status(400).json({ 
      error: 'Invalid coordinate format' 
    });
    return;
  }

  // Validate coordinate ranges
  const isValidLat = (lat: number) => lat >= -90 && lat <= 90;
  const isValidLng = (lng: number) => lng >= -180 && lng <= 180;

  if (!isValidLat(from.lat) || !isValidLng(from.lng) ||
      !isValidLat(to.lat) || !isValidLng(to.lng)) {
    res.status(400).json({ 
      error: 'Coordinates out of valid range' 
    });
    return;
  }

  next();
};

