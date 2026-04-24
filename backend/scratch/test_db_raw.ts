import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function testConnection() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');
    
    const res = await client.query('SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = \'public\'');
    console.log('Tables in public schema:', res.rows.map(r => r.tablename));
    
    await client.end();
  } catch (err) {
    console.error('Connection failed:', err);
  }
}

testConnection();
