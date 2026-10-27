import { Router } from "express";
import { ADMIN, MANAGER, RRPP, SUPERADMIN, accesoBoliche, soloRoles, verificarToken } from "../middleware/auth.js";
import { agregarAdmin, crearBoliche, editarBoliche, listarBoliches, quitarAdmin, verBoliche } from "../controllers/boliche.controller.js";
import { crearMiembro, darDeBaja, editarMiembro, listarEquipo } from "../controllers/equipo.controller.js";
import { crearEvento, editarEvento, eliminarEvento, listarEventos, verEvento } from "../controllers/evento.controller.js";

// Todo lo de un boliche cuelga de /boliches/:idBoliche, y accesoBoliche decide en UN solo lugar si la persona puede entrar.
// Quien no es del boliche recibe 404, igual que si no existiera.
const router = Router();
router.use(verificarToken);

router.get("/", soloRoles(SUPERADMIN, ADMIN, MANAGER, RRPP), listarBoliches);
router.post("/", soloRoles(SUPERADMIN), crearBoliche);

const delBoliche = Router({ mergeParams: true });
delBoliche.use(soloRoles(SUPERADMIN, ADMIN, MANAGER, RRPP), accesoBoliche);

delBoliche.get("/", verBoliche);
delBoliche.put("/", soloRoles(SUPERADMIN, ADMIN), editarBoliche);

// Los admins de un boliche los maneja el superadmin.
delBoliche.post("/admins", soloRoles(SUPERADMIN), agregarAdmin);
delBoliche.delete("/admins/:idUsuario", soloRoles(SUPERADMIN), quitarAdmin);

// Equipo de RRPP: el RRPP común no lo ve; el manager ve y asigna a los suyos.
delBoliche.get("/equipo", soloRoles(SUPERADMIN, ADMIN, MANAGER), listarEquipo);
delBoliche.post("/equipo", soloRoles(SUPERADMIN, ADMIN, MANAGER), crearMiembro);
delBoliche.put("/equipo/:idUsuario", soloRoles(SUPERADMIN, ADMIN, MANAGER), editarMiembro);
delBoliche.delete("/equipo/:idUsuario", soloRoles(SUPERADMIN, ADMIN), darDeBaja);

// Eventos: todos los del boliche los ven; crean el superadmin, el admin y el manager.
delBoliche.get("/eventos", listarEventos);
delBoliche.post("/eventos", soloRoles(SUPERADMIN, ADMIN, MANAGER), crearEvento);
delBoliche.get("/eventos/:idEvento", verEvento);
delBoliche.put("/eventos/:idEvento", soloRoles(SUPERADMIN, ADMIN, MANAGER), editarEvento);
delBoliche.delete("/eventos/:idEvento", soloRoles(SUPERADMIN, ADMIN), eliminarEvento);

router.use("/:idBoliche", delBoliche);

export default router;
