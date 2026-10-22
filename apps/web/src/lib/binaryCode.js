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
  let str = '';
  if (Buffer.isBuffer(codeField)) {
    str = codeField.toString('utf8');
  } else if (codeField instanceof Uint8Array) {
    str = Buffer.from(codeField).toString('utf8');
  } else if (typeof codeField === 'object' && codeField.type === 'Buffer' && Array.isArray(codeField.data)) {
    str = Buffer.from(codeField.data).toString('utf8');
  } else if (typeof codeField === 'string') {
    if (codeField.startsWith('\\x')) {
      str = Buffer.from(codeField.slice(2), 'hex').toString('utf8');
    } else {
      str = codeField;
    }
  } else {
    str = String(codeField);
  }

  // If the extracted code is base64 encoded, unwrap it to plain text
  const trimmed = str.trim();
  if (trimmed.length > 20 && trimmed.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
    try {
      const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
      if (Buffer.from(decoded, 'utf8').toString('base64') === trimmed && !decoded.includes('\uFFFD')) {
        return decoded;
      }
    } catch {
      // Keep original str if base64 decoding fails
    }
  }

  return str;
}
