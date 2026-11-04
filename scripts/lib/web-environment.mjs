// Only frontend/runtime settings cross into the independently running Next.js process.
export function webEnvironment(inherited, { port, hostname = '127.0.0.1', production = false }) {
  const allowed = new Set(['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'TZ', 'LANG', 'LC_ALL', 'NEXT_TELEMETRY_DISABLED']);
  const env = Object.fromEntries(Object.entries(inherited).filter(([key]) => allowed.has(key.toUpperCase()) || key.startsWith('NEXT_PUBLIC_')));
  return { ...env, PORT: String(port), HOSTNAME: hostname, NODE_ENV: production ? 'production' : 'development' };
}
