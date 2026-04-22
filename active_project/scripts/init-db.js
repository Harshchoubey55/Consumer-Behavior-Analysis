const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function initDB() {
    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

    if (!dbUrl) {
        console.error('Error: DATABASE_URL or POSTGRES_URL environment variable is not defined.');
        console.error('If you are deploying to Vercel, link your Vercel Postgres or Supabase database to expose these variables.');
        process.exit(1);
    }

    const client = new Client({
        connectionString: dbUrl,
        ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to PostgreSQL Database.');

        const schemaPath = path.join(__dirname, '..', 'init.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('Executing init.sql schema...');
        await client.query(schema);

        console.log('Database initialized successfully. All tables are ready to ingest behavior data.');
    } catch (err) {
        console.error('Failed to initialize database:', err);
    } finally {
        await client.end();
    }
}

initDB();
