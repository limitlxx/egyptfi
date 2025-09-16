import { Pool } from 'pg';

require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined
});

pool.on('connect', () => {
    console.log('Database connection established');
});

pool.on('error', (err: any) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});
 
export default pool;