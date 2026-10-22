import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// App-local files override root defaults; existing process variables always win.
// This module must be imported before modules that read configuration at import.
const root = fileURLToPath(new URL('../../../../', import.meta.url));
dotenv.config({ path: ['.env.local', '.env', `${root}.env.local`, `${root}.env`], quiet: true });
