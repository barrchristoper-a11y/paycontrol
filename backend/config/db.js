const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    // Neon requires SSL.
    ssl: {
        rejectUnauthorized: false,
    },

    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// Test connection
pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool,
};