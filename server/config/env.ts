import dotenv from 'dotenv';

dotenv.config();

export function normalizeDatabaseUrl(raw: string): string {
  if (!raw) return raw;
  const trimmed = raw.trim();
  if (trimmed.startsWith('postgresql://') || trimmed.startsWith('postgres://')) {
    return trimmed;
  }
  // Handles formatted strings like postgresql:PASSWORD//USER:@HOST:PORT/DB...
  const match = trimmed.match(/^postgresql:([^/]+)\/\/([^:]+):@([^:]+):(\d+)\/(.+)$/);
  if (match) {
    const [, pass, user, host, port, rest] = match;
    return `postgresql://${user}:${encodeURIComponent(pass)}@${host}:${port}/${rest}`;
  }
  return trimmed;
}

export const config = {
  port: parseInt(process.env.SERVER_PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: normalizeDatabaseUrl(process.env.DATABASE_URL || ''),
};
