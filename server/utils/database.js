import dotenv from 'dotenv';
dotenv.config();

import mariadb from "mariadb";

export async function pool_setup() {
  const pool = mariadb.createPool({
    host: process.env.RDS_HOST,       // RDS endpoint RDS_HOST=your-rds-endpoint.amazonaws.com
    user: process.env.RDS_USER,       // DB username
    password: process.env.RDS_PASSWORD, // DB password
    database: process.env.RDS_DATABASE, // DB name
    port: process.env.RDS_PORT || 3306, // optional, default 3306
    connectionLimit: 5,
  });

  return pool;
}
