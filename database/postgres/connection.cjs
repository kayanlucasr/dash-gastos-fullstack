require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});
pool.on("error", (error) => {
  console.error("Erro em conexão ociosa do banco:", error.code || "DATABASE_ERROR");
});

module.exports = pool;
