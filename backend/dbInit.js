const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '.env') });

function getDbConfig() {
  const required = ['PGHOST', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'];
  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(`Missing required database environment variables: ${missing.join(', ')}`);
  }

  const port = Number(process.env.PGPORT || 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PGPORT must be an integer between 1 and 65535.');
  }

  return {
    host: process.env.PGHOST,
    port,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: {
      rejectUnauthorized: true
    }
  };
}

async function run() {
  let client;

  try {
    client = new Client(getDbConfig());
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully! Reading schema.sql...');

    const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Applying database schema (this may take a few seconds)...');
    await client.query(sql);

    console.log('Database schema applied successfully!');
  } catch (error) {
    console.error('Error applying database schema:', error.message);
    process.exitCode = 1;
  } finally {
    if (client) {
      await client.end().catch((error) => {
        console.error('Error closing database connection:', error.message);
        process.exitCode = 1;
      });
      console.log('Database connection closed.');
    }
  }
}

run();
