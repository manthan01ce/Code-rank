/**
 * Shared identifier validation utilities
 */

const fail = (status, message) => {
  throw { status, message };
};

/**
 * Validate and parse a positive integer identifier
 * @param {*} value - Value to validate
 * @returns {number} Validated positive integer
 * @throws {Object} Error with status and message
 */
export function positiveId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    fail(400, 'Invalid identifier');
  }
  return id;
}
