/**
 * packages/core/src/utils/auth.js — JWT & password utilities
 * Shared across apps/web (API routes) and apps/worker (if needed).
 * No Next.js / browser dependencies — pure Node.js.
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is missing.');
}

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      session_token: user.session_token,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function generateSecurePassword(length = 10) {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%';
  const all = uppercase + lowercase + digits + special;

  let password = '';
  password += uppercase[crypto.randomInt(0, uppercase.length)];
  password += lowercase[crypto.randomInt(0, lowercase.length)];
  password += digits[crypto.randomInt(0, digits.length)];
  password += special[crypto.randomInt(0, special.length)];

  for (let i = 4; i < length; i++) {
    password += all[crypto.randomInt(0, all.length)];
  }

  // Fisher-Yates Shuffle using secure random index
  const arr = password.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr.join('');
}

/**
 * Extract & verify the Bearer token from a Next.js or Node.js Request object.
 * Works with both Next.js Request (has .headers.get) and Node.js IncomingMessage.
 */
export function getUserFromRequest(request) {
  let authHeader;
  if (typeof request.headers?.get === 'function') {
    // Next.js Request
    authHeader = request.headers.get('authorization');
  } else {
    // Node.js IncomingMessage
    authHeader = request.headers?.authorization;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  return verifyToken(token);
}
