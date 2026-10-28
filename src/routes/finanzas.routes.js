import { Router } from "express";
import { ADMIN, SUPERADMIN, soloRoles, verificarToken } from "../middleware/auth.js";
import { finanzasGenerales } from "../controllers/finanzas.controller.js";

// El resumen general del admin: todos sus boliches juntos.
const router = Router();
router.use(verificarToken, soloRoles(SUPERADMIN, ADMIN));

router.get("/", finanzasGenerales);

export default router;
