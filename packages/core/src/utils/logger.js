/**
 * packages/core/src/utils/logger.js — Centralized structured logger
 * Used by both apps/web and apps/worker.
 */
export const logger = {
  info(message, meta = {}) {
    console.log(JSON.stringify({
      level: 'INFO',
      timestamp: new Date().toISOString(),
      message,
      ...meta
    }));
  },

  warn(message, meta = {}) {
    console.warn(JSON.stringify({
      level: 'WARN',
      timestamp: new Date().toISOString(),
      message,
      ...meta
    }));
  },

  error(message, error = null, meta = {}) {
    console.error(JSON.stringify({
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      message,
      error: error ? { message: error.message, stack: error.stack } : null,
      ...meta
    }));
  }
};
