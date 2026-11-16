import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';

const ssl = process.env.DB_SSL === 'true'
  ? { rejectUnauthorized: true, ...(process.env.DB_SSL_CA ? { ca: readFileSync(process.env.DB_SSL_CA, 'utf8') } : {}) }
  : undefined;

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'clinica-alejandra',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'Z',
  dateStrings: true,
  decimalNumbers: true,
  ...(ssl ? { ssl } : {}),
});

// El esquema usa DATETIME sin zona horaria; fija la zona de cada sesión MySQL a Colombia.
pool.on('connection', (connection) => {
  connection.query("SET time_zone = '-05:00'");
});

export async function checkDatabase() {
  const [rows] = await pool.query('SELECT DATABASE() AS database_name, 1 AS ok');
  return rows[0];
}
