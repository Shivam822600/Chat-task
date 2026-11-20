import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// express 4 doesn't catch rejected promises on its own
export function wrap(fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const code = (err as { code?: string }).code;

  if (err instanceof ZodError) {
    const msg = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    res.status(400).json({ error: msg });
  } else if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
  } else if (code === '23503') {
    // postgres foreign key error, one of the user ids doesn't exist
    res.status(404).json({ error: 'user not found' });
  } else if (code === '23505') {
    res.status(409).json({ error: 'already exists' });
  } else {
    console.error(err);
    res.status(500).json({ error: 'something went wrong' });
  }
}
