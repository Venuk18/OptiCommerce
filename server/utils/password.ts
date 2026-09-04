import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hashes a plaintext password securely using bcryptjs.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifies a plaintext password against a stored bcrypt hash.
 */
export async function verifyPassword(password: string, passwordHash?: string | null): Promise<boolean> {
  if (!password || !passwordHash) {
    return false;
  }
  try {
    return await bcrypt.compare(password, passwordHash);
  } catch (err) {
    return false;
  }
}
