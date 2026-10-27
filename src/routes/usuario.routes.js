import { Router } from "express";
import { SUPERADMIN, soloRoles, verificarToken } from "../middleware/auth.js";
import { crearAdmin, editarUsuario, listarUsuarios } from "../controllers/usuario.controller.js";

// Los usuarios de todo el sistema los maneja solo el superadmin.
const router = Router();
router.use(verificarToken, soloRoles(SUPERADMIN));

router.get("/", listarUsuarios);
router.post("/", crearAdmin);
router.put("/:idUsuario", editarUsuario);

export default router;
