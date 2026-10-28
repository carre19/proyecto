import { Router } from "express";
import { SUPERADMIN, soloRoles, verificarToken } from "../middleware/auth.js";
import { crearAdmin, editarUsuario, listarUsuarios } from "../controllers/usuario.controller.js";
import { resetear2fa } from "../controllers/auth.controller.js";

// Los usuarios de todo el sistema los maneja solo el superadmin.
const router = Router();
router.use(verificarToken, soloRoles(SUPERADMIN));

router.get("/", listarUsuarios);
router.post("/", crearAdmin);
router.put("/:idUsuario", editarUsuario);
// Si un admin pierde el celular y los códigos de recuperación, el superadmin le restablece la verificación en dos pasos.
router.delete("/:id/2fa", resetear2fa);

export default router;
