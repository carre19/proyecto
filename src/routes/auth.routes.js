import { Router } from "express";
import { verificarToken } from "../middleware/auth.js";
import { limitar } from "../middleware/limite.js";
import { activar2fa, desactivar2fa, estado2fa, login, perfil, preparar2fa, registrar, verificarSegundoPaso } from "../controllers/auth.controller.js";

const router = Router();

// Se limitan los intentos por dirección para frenar el adivinar contraseñas y códigos.
const limiteLogin = limitar(Number(process.env.LIMITE_LOGIN ?? 30), 10 * 60 * 1000);

router.post("/register", registrar);
router.post("/login", limiteLogin, login);
router.get("/perfil", verificarToken, perfil);

// Verificación en dos pasos (admins). /2fa/verificar completa el login con el ticket; el resto necesita sesión.
router.post("/2fa/verificar", limiteLogin, verificarSegundoPaso);
router.get("/2fa", verificarToken, estado2fa);
router.post("/2fa/preparar", verificarToken, preparar2fa);
router.post("/2fa/activar", verificarToken, activar2fa);
router.post("/2fa/desactivar", verificarToken, desactivar2fa);

export default router;
