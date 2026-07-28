// Generates seed-ready.sql with real PBKDF2 password hashes (same scheme as functions/_lib.js).
// Run: node gen-seed.js   ->  writes seed-ready.sql
import { hashPassword } from './functions/_lib.js';
import { writeFileSync, readFileSync } from 'node:fs';

const adminHash = await hashPassword('Admin@123');
const demoHash = await hashPassword('Demo@123');

const sql = readFileSync(new URL('./seed.sql', import.meta.url), 'utf8')
  .replace('__ADMIN_HASH__', adminHash)
  .replace('__DEMO_HASH__', demoHash);

writeFileSync(new URL('./seed-ready.sql', import.meta.url), sql);
console.log('Wrote seed-ready.sql');
console.log('  admin@demo.com / Admin@123');
console.log('  demo@demo.com  / Demo@123');
