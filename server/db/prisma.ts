import { PrismaClient } from '@prisma/client';
import { config } from '../config/env';

export const prisma = new PrismaClient(
  config.databaseUrl
    ? {
        datasources: {
          db: {
            url: config.databaseUrl,
          },
        },
      }
    : undefined
);

export async function testDatabaseConnection(): Promise<{ success: boolean; message: string }> {
  const dbUrl = config.databaseUrl;
  if (!dbUrl) {
    return {
      success: false,
      message: 'DATABASE_URL environment variable is not configured.',
    };
  }

  try {
    await prisma.$queryRaw`SELECT 1 as connected`;
    return {
      success: true,
      message: 'Successfully connected to Supabase PostgreSQL database via Prisma.',
    };
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Database connection failed: ${errMessage}`,
    };
  }
}
