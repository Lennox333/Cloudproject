import dotenv from 'dotenv';
dotenv.config();

import mariadb from "mariadb";

export async function pool_setup() {
  const pool = mariadb.createPool({
    host: process.env.HOST,
    user: process.env.MARIA_USER,
    password: process.env.MARIA_PASSWORD,
    database: process.env.MARIA_DATABASE,
    connectionLimit: 5,
  });

  return pool;
}
