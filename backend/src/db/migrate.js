require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query } = require('./database');

async function migrate() {
  console.log('Running migrations...');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await query(schema);
  console.log('Migrations complete.');
  process.exit(0);
}

migrate().catch((err) => { console.error(err); process.exit(1); });
