import { Router } from "express";
import { obtenerEventoPublico, responderPropuestaPublica } from "../controllers/publico.controller.js";

const router = Router();

// Sin verificarToken: el acceso es el token del evento que va en la URL.
router.get("/evento/:token", obtenerEventoPublico);
router.post("/evento/:token/respuesta", responderPropuestaPublica);

export default router;
