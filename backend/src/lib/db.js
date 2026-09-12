import { neon } from '@neondatabase/serverless';

// Use environment DATABASE_URL, with a safe placeholder fallback to avoid compile-time crashes during Vercel/Next.js build phases
const connectionString = process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost/placeholder';
const sql = neon(connectionString);

export default sql;
