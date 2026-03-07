import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database service migrations...');
    
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Get executed migrations
    const { rows: executedMigrations } = await client.query(
      'SELECT name FROM migrations ORDER BY id'
    );
    const executed = new Set(executedMigrations.map(m => m.name));
    
    // Read migration files from migrations/database folder
    const migrationsDir = path.join(__dirname, '../migrations/database');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('No database migrations folder found. Skipping...');
      return;
    }
    
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    for (const file of files) {
      if (executed.has(file)) {
        console.log(`⏭️  Skipping ${file} (already executed)`);
        continue;
      }
      
      console.log(`▶️  Executing ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`✅ ${file} executed successfully`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Error executing ${file}:`, err);
        throw err;
      }
    }
    
    console.log('✨ Database service migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
