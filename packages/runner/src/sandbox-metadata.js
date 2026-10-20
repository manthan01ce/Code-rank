import { randomUUID } from 'node:crypto';

export const SANDBOX_OWNER = randomUUID();
export const SANDBOX_VERSION = '1';
export const SANDBOX_PREFIX = 'coderank.sandbox.';
export function sandboxScope(scope = process.env.SANDBOX_SCOPE || 'coderank') {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$/.test(scope)) throw new Error('Invalid SANDBOX_SCOPE');
  return scope;
}
