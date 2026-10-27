import { Router } from "express";
import { listarBoliches, verBoliche } from "../controllers/publico.controller.js";

// Sin cuenta: lo que ve cualquier persona.
const router = Router();

router.get("/boliches", listarBoliches);
router.get("/boliches/:subdominio", verBoliche);

export default router;
