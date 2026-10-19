import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './pool.js';
const here = path.dirname(fileURLToPath(import.meta.url));
try {
  const sql = await readFile(path.resolve(here, '../../migrations/001_initial.sql'), 'utf8');
  await pool.query(sql);
  console.log('Database migration applied.');
} catch (error) {
  console.error('Migration failed:', error);
  process.exitCode = 1;
} finally { await pool.end(); }
