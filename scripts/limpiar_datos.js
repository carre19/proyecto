// Corre ahora el borrado de datos personales vencidos (ver src/utils/retencion.js). Lo mismo corre solo una vez por día.
//   npm run limpiar-datos
import "dotenv/config";
import pool from "../src/data/db.js";
import { limpiarDatosVencidos } from "../src/utils/retencion.js";

try {
    console.log("Datos borrados:", await limpiarDatosVencidos(pool));
} finally {
    await pool.end();
}
