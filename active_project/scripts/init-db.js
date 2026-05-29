const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * Cloud database initializer.
 * Runs all 5 SQL migration files in order (001→005) from analytics-engine/sql/.
 *
 * Previously this ran only init.sql which was missing ~80% of the schema
 * (no markov_transitions, decision_contexts, session_risk_log, intervention_logs, etc.).
 * Now uses the same authoritative SQL files as docker-compose.
 */
const SQL_FILES = [
    '001_schema.sql',
    '002_seed.sql',
    '003_sequences.sql',
    '004_context.sql',
    '005_context_seed.sql',
    '006_phenotypes.sql',
];

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

        const sqlDir = path.join(__dirname, '..', 'analytics-engine', 'sql');

        for (const file of SQL_FILES) {
            const filePath = path.join(sqlDir, file);
            if (!fs.existsSync(filePath)) {
                console.warn(`Warning: ${file} not found at ${filePath}, skipping.`);
                continue;
            }
            const sql = fs.readFileSync(filePath, 'utf8');
            console.log(`Executing ${file}...`);
            await client.query(sql);
            console.log(`  ✓ ${file} complete.`);
        }

        console.log('\nDatabase initialized successfully. All tables are ready to ingest behavior data.');
    } catch (err) {
        console.error('Failed to initialize database:', err);
    } finally {
        await client.end();
    }
}

initDB();
