import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { config } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

mkdirSync(dirname(config.DB_PATH), { recursive: true });
export const db = new Database(config.DB_PATH);
db.pragma('journal_mode = WAL');

const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);
