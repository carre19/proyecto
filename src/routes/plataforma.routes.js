import { Router } from "express";
import { SUPERADMIN, soloRoles, verificarToken } from "../middleware/auth.js";
import { ejecutarRetencion, generarCobros, listarCobros, pagarCobro, resumenPlataforma } from "../controllers/plataforma.controller.js";

// Lo que maneja solo el superadmin de la plataforma: sus cobros a los boliches, lo que gana por entradas y el borrado de datos vencidos.
const router = Router();
router.use(verificarToken, soloRoles(SUPERADMIN));

router.get("/resumen", resumenPlataforma);
router.post("/cobros/generar", generarCobros);
router.get("/cobros", listarCobros);
router.put("/cobros/:idCobro/pagar", pagarCobro);
router.post("/retencion/ejecutar", ejecutarRetencion);

export default router;
