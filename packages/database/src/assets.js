// Module-relative asset URLs work independently of cwd and OS path separators.
export const migrationDirectory = new URL('../migrations/', import.meta.url);
export const bootstrapSQL = new URL('../bootstrap/init.sql', import.meta.url);
