import { Router } from "express";
import { CLIENTE, soloRoles, verificarToken } from "../middleware/auth.js";
import { misCompras } from "../controllers/compra.controller.js";

// Lo que hace el cliente con su cuenta (la cuenta es opcional: se puede comprar sin ella).
const router = Router();
router.use(verificarToken, soloRoles(CLIENTE));

router.get("/compras", misCompras);

export default router;
