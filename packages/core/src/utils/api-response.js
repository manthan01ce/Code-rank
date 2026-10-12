/**
 * Standardized error codes for API responses
 */
export const ErrorCode = {
  DB_ERROR: 'DB_ERROR',
  REDIS_ERROR: 'REDIS_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  QUEUE_FULL: 'QUEUE_FULL',
  TIMEOUT: 'TIMEOUT',
  CIRCUIT_OPEN: 'CIRCUIT_OPEN'
};

/**
 * Create a standardized error response object
 * @param {string} message - Human-readable error message
 * @param {string} code - Error code from ErrorCode enum
 * @param {number} status - HTTP status code
 * @param {number} [retryAfter] - Optional Retry-After header value in seconds
 * @returns {object} Standardized error response object with headers
 */
export function errorResponse(message, code, status, retryAfter = null) {
  const response = {
    error: message,
    code,
    timestamp: new Date().toISOString()
  };

  const headers = {};

  // Add Retry-After header for 429 (rate limit) and 503 (service unavailable) responses
  if (retryAfter !== null && (status === 429 || status === 503)) {
    headers['Retry-After'] = retryAfter.toString();
  }

  return {
    body: response,
    status,
    headers
  };
}
