import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app.error';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
      },
    });
    return;
  }

  // Handle Prisma unique constraint violations (code P2002) if uncaught
  if (err?.code === 'P2002') {
    const fields = (err?.meta?.target as string[])?.join(', ') || 'resource';
    res.status(409).json({
      success: false,
      error: {
        message: `Unique constraint failed on field(s): ${fields}`,
      },
    });
    return;
  }

  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: {
      message: err?.message || 'Internal Server Error',
    },
  });
};
