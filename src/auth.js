import crypto from 'node:crypto';

const HASH_ALGO = 'sha256';
const SALT = process.env.PASSWORD_SALT || 'agriturismo-platform-salt';

export function hashPassword(password) {
  return crypto.createHash(HASH_ALGO).update(`${SALT}:${password}`).digest('hex');
}

export function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

export function generateToken(length = 24) {
  return crypto.randomBytes(length).toString('hex');
}
