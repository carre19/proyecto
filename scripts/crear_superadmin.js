// Crea una cuenta de superadmin (el programador, que ve y maneja todo). Uso:
//   node scripts/crear_superadmin.js email@dominio.com "una contraseña" Nombre Apellido
// Lee la conexión del .env. Si el email ya existe, no hace nada.
import "dotenv/config";
import pool from "../src/data/db.js";
import { validarPersona } from "../src/utils/validaciones.js";
import { insertarUsuario } from "../src/utils/usuarios.js";

const [email, password, nombre = "Super", apellido = "Admin"] = process.argv.slice(2);
const { error, datos } = validarPersona({ email, password, nombre, apellido });
if (error) {
  console.error(`Datos inválidos: ${error}\nUso: node scripts/crear_superadmin.js email "contraseña" [Nombre] [Apellido]`);
  process.exit(1);
}

try {
  const usuario = await insertarUsuario(pool, datos, "superadmin");
  console.log(`Superadmin creado: ${usuario.email} (${usuario.nombre_completo})`);
} catch (e) {
  console.error(e.code === "23505" ? "Ese email ya está registrado." : e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
