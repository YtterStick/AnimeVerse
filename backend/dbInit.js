const fs = require('fs');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const path = require('path');
const { Client } = require('pg');

async function run() {
  console.log('Connecting to database via IPv6 direct IP...');
  const client = new Client({
    host: '[2406:da1c:4c7:f800:ef9e:af59:bd8f:e227]',
    port: 5432,
    user: 'postgres',
    password: '!Andrei0612Dilag0612',
    database: 'postgres',
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected successfully! Reading schema.sql...');

    const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Applying database schema (this may take a few seconds)...');
    await client.query(sql);

    console.log('Database schema applied successfully!');
  } catch (error) {
    console.error('Error applying database schema:', error);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

run();
