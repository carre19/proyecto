import { Router } from "express";
import { webhook } from "../controllers/pago.controller.js";

// Rutas de pagos que no son de una persona con sesión: el aviso automático de una transferencia (va firmado).
const router = Router();

router.post("/webhook", webhook);

export default router;
