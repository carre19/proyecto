import { Router } from "express";
import { tokenOpcional } from "../middleware/auth.js";
import { limitar } from "../middleware/limite.js";
import { comprar, verCompra } from "../controllers/compra.controller.js";
import { listarBoliches, verBoliche } from "../controllers/publico.controller.js";

// Sin cuenta: lo que ve cualquier persona.
const router = Router();

router.get("/boliches", listarBoliches);
router.get("/boliches/:subdominio", verBoliche);

// Comprar entradas (con la cuenta del cliente si tiene sesión, o sin cuenta) y ver la compra con el link que se recibe.
// Se limitan los intentos por dirección: sin esto alguien podría reservar todo el cupo con compras falsas.
router.post("/boliches/:subdominio/eventos/:idEvento/comprar", limitar(Number(process.env.LIMITE_COMPRAS ?? 30), 10 * 60 * 1000), tokenOpcional, comprar);
router.get("/compras/:token", verCompra);

export default router;
