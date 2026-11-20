import 'dotenv/config';
import { readFileSync } from 'fs';
import path from 'path';
import { pool } from '../db';

async function run() {
  const sql = readFileSync(path.join(__dirname, '../../sql/schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('tables created');
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
