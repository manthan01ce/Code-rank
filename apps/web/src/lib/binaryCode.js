/**
 * Helper utility for encoding source code to binary Buffer for BYTEA database storage
 * and decoding BYTEA / Buffer / Hex data back to UTF-8 text strings.
 */

export function encodeBinaryCode(code) {
  if (!code) return Buffer.from('', 'utf8');
  if (Buffer.isBuffer(code)) return code;
  return Buffer.from(String(code), 'utf8');
}

export function decodeBinaryCode(codeField) {
  if (!codeField) return '';
  if (Buffer.isBuffer(codeField)) {
    return codeField.toString('utf8');
  }
  if (codeField instanceof Uint8Array) {
    return Buffer.from(codeField).toString('utf8');
  }
  if (typeof codeField === 'object' && codeField.type === 'Buffer' && Array.isArray(codeField.data)) {
    return Buffer.from(codeField.data).toString('utf8');
  }
  if (typeof codeField === 'string') {
    if (codeField.startsWith('\\x')) {
      return Buffer.from(codeField.slice(2), 'hex').toString('utf8');
    }
    return codeField;
  }
  return String(codeField);
}
