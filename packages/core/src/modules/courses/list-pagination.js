export function listPage({ cursor, limit = 100 } = {}, { textCursor = false } = {}) {
  const size = Number(limit);
  if (!Number.isSafeInteger(size) || size < 1 || size > 500) {
    throw { status: 400, message: 'limit must be an integer between 1 and 500' };
  }
  let after = cursor == null || cursor === '' ? null : cursor;
  if (after !== null) {
    if (textCursor) {
      if (typeof after !== 'string' || after.length > 256) throw { status: 400, message: 'Invalid cursor' };
    } else {
      if (!/^\d+$/.test(String(after)) || !Number.isSafeInteger(Number(after)) || Number(after) < 1) {
        throw { status: 400, message: 'Invalid cursor' };
      }
      after = Number(after);
    }
  }
  return { cursor: after, limit: size };
}
