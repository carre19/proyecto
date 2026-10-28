import pg from "pg";

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false
});

// Si Postgres corta una conexión que estaba libre (se reinició, se cayó la red), el pool lo avisa con este evento.
// Sin este manejador, Node cierra todo el servidor; así solo se anota y el pool abre otra conexión cuando haga falta.
pool.on("error", (error) => {
  console.error("Se perdió una conexión libre con la base:", error.message);
});

export default pool;
