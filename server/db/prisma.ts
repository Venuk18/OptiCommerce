import { PrismaClient } from '@prisma/client';
import { config } from '../config/env';
import { createInMemoryPrismaProxy } from './in-memory-db';

let realPrismaClient: PrismaClient | null = null;
let isRealDbConnected = false;

const inMemoryFallback = createInMemoryPrismaProxy();

function getRealPrisma(): PrismaClient | null {
  if (!config.databaseUrl) {
    return null;
  }
  if (!realPrismaClient) {
    try {
      realPrismaClient = new PrismaClient({
        datasources: {
          db: {
            url: config.databaseUrl,
          },
        },
      });
    } catch (e) {
      console.warn('[Prisma] Failed to instantiate PrismaClient with URL:', e);
      return null;
    }
  }
  return realPrismaClient;
}

export const prisma: any = new Proxy(
  {},
  {
    get(_target, prop: string) {
      if (prop === '$queryRaw' || prop === '$executeRawUnsafe' || prop === '$connect' || prop === '$disconnect' || prop === '$transaction') {
        return async (...args: any[]) => {
          if (prop === '$transaction') {
            const input = args[0];
            const client = getRealPrisma();
            if (client && isRealDbConnected && (client as any).$transaction) {
              try {
                return await (client as any).$transaction(...args);
              } catch (err: any) {
                console.warn('[Prisma $transaction Notice] Falling back to memory transaction');
              }
            }
            if (typeof input === 'function') {
              return await input(prisma);
            }
            if (Array.isArray(input)) {
              const res = [];
              for (const p of input) {
                res.push(await p);
              }
              return res;
            }
            return input;
          }
          if (prop === '$connect' || prop === '$disconnect') {
            const client = getRealPrisma();
            if (client && (client as any)[prop]) {
              try {
                await (client as any)[prop]();
              } catch (_) {}
            }
            return;
          }
          const client = getRealPrisma();
          if (client && isRealDbConnected) {
            try {
              return await (client as any)[prop](...args);
            } catch (err: any) {
              console.warn(`[Prisma Query Notice]: ${prop} fallback to memory`);
              return await (inMemoryFallback as any)[prop](...args);
            }
          }
          return await (inMemoryFallback as any)[prop](...args);
        };
      }

      const memoryModel = (inMemoryFallback as any)[prop];
      if (!memoryModel) {
        return undefined;
      }

      return new Proxy(memoryModel, {
        get(modelTarget, action: string) {
          return async (...args: any[]) => {
            const client = getRealPrisma();
            if (client && isRealDbConnected && (client as any)[prop]?.[action]) {
              try {
                return await (client as any)[prop][action](...args);
              } catch (err: any) {
                const isInitOrConnError =
                  err?.name === 'PrismaClientInitializationError' ||
                  err?.name === 'PrismaClientRustPanicError' ||
                  err?.code === 'P1000' ||
                  err?.code === 'P1001' ||
                  err?.code === 'P1002';

                if (isInitOrConnError) {
                  console.warn(`[Prisma Database Disconnected] Falling back ${prop}.${action} to in-memory store`);
                  isRealDbConnected = false;
                } else {
                  console.warn(`[Prisma Error] in ${prop}.${action}:`, err?.message || err);
                }

                if (modelTarget[action]) {
                  return await modelTarget[action](...args);
                }
                throw err;
              }
            }

            if (modelTarget[action]) {
              return await modelTarget[action](...args);
            }
            return null;
          };
        },
      });
    },
  }
);

export async function testDatabaseConnection(): Promise<{ success: boolean; message: string }> {
  const dbUrl = config.databaseUrl;
  if (!dbUrl) {
    isRealDbConnected = false;
    return {
      success: false,
      message: 'DATABASE_URL environment variable is not configured. Running with in-memory store.',
    };
  }

  const client = getRealPrisma();
  if (!client) {
    isRealDbConnected = false;
    return {
      success: false,
      message: 'Could not create Prisma client instance.',
    };
  }

  try {
    await client.$queryRaw`SELECT 1 as connected`;
    isRealDbConnected = true;
    return {
      success: true,
      message: 'Successfully connected to PostgreSQL database via Prisma.',
    };
  } catch (error) {
    isRealDbConnected = false;
    const errMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Database connection failed: ${errMessage}`,
    };
  }
}
