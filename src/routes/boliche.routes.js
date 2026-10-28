import { Router } from "express";
import { ADMIN, MANAGER, RRPP, SUPERADMIN, accesoBoliche, soloRoles, verificarToken } from "../middleware/auth.js";
import { agregarAdmin, crearBoliche, editarBoliche, listarBoliches, quitarAdmin, verBoliche } from "../controllers/boliche.controller.js";
import { borrarFoto, editarFoto, listarFotos, subirFoto } from "../controllers/foto.controller.js";
import { crearEntrada, editarEntrada, eliminarEntrada, listarEntradas } from "../controllers/entrada.controller.js";
import { borrarImagenBebida, crearBebida, editarBebida, eliminarBebida, listarBebidas, subirImagenBebida } from "../controllers/bebida.controller.js";
import { borrarImagenMesa, crearMesa, editarMesa, eliminarMesa, listarMesas, listarMesasDelEvento, ofrecerMesa, subirImagenMesa } from "../controllers/mesa.controller.js";
import { guardarTema, restablecerTema, verTema } from "../controllers/tema.controller.js";
import { recibirImagen } from "../middleware/imagen.js";
import { cancelarCompra, listarVentas, pagarCompra, ventaPuerta } from "../controllers/venta.controller.js";
import { buscarPorDni, escanear, reingreso, resumenPuerta, ultimosAccesos } from "../controllers/puerta.controller.js";
import { crearMiembro, darDeBaja, editarMiembro, listarEquipo } from "../controllers/equipo.controller.js";
import { borrarImagenEvento, crearEvento, editarEvento, eliminarEvento, listarEventos, subirImagenEvento, verEvento } from "../controllers/evento.controller.js";

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

// Fotos del local: las suben y las borran el superadmin y el admin del boliche (el cuerpo es la imagen).
// Todo lo de la ficha del boliche (fotos, entradas, bebidas, mesas VIP y colores) lo ven todos los del boliche
// y lo editan solo el superadmin y el admin.
const edita = soloRoles(SUPERADMIN, ADMIN);

delBoliche.get("/fotos", listarFotos);
delBoliche.post("/fotos", edita, recibirImagen, subirFoto);
delBoliche.put("/fotos/:idFoto", edita, editarFoto);
delBoliche.delete("/fotos/:idFoto", edita, borrarFoto);

// Bebidas: la carta del boliche. Cada una que se carga queda guardada.
delBoliche.get("/bebidas", listarBebidas);
delBoliche.post("/bebidas", edita, crearBebida);
delBoliche.put("/bebidas/:idBebida", edita, editarBebida);
delBoliche.delete("/bebidas/:idBebida", edita, eliminarBebida);
delBoliche.post("/bebidas/:idBebida/imagen", edita, recibirImagen, subirImagenBebida);
delBoliche.delete("/bebidas/:idBebida/imagen", edita, borrarImagenBebida);

// Mesas VIP del boliche.
delBoliche.get("/mesas-vip", listarMesas);
delBoliche.post("/mesas-vip", edita, crearMesa);
delBoliche.put("/mesas-vip/:idMesa", edita, editarMesa);
delBoliche.delete("/mesas-vip/:idMesa", edita, eliminarMesa);
delBoliche.post("/mesas-vip/:idMesa/imagen", edita, recibirImagen, subirImagenMesa);
delBoliche.delete("/mesas-vip/:idMesa/imagen", edita, borrarImagenMesa);

// Colores de la página del boliche (modo claro y oscuro).
delBoliche.get("/tema", verTema);
delBoliche.put("/tema", edita, guardarTema);
delBoliche.delete("/tema", edita, restablecerTema);

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

// Entradas de cada evento (tandas y VIP) y mesas VIP que ofrece cada evento.
delBoliche.get("/eventos/:idEvento/entradas", listarEntradas);
delBoliche.post("/eventos/:idEvento/entradas", edita, crearEntrada);
delBoliche.put("/eventos/:idEvento/entradas/:idEntrada", edita, editarEntrada);
delBoliche.delete("/eventos/:idEvento/entradas/:idEntrada", edita, eliminarEntrada);
delBoliche.get("/eventos/:idEvento/mesas-vip", listarMesasDelEvento);
delBoliche.put("/eventos/:idEvento/mesas-vip/:idMesa", edita, ofrecerMesa);

// Ventas (fase 2). Las ve cada rol según corresponda (el RRPP solo las suyas); confirmar o cancelar pagos lo hacen el admin y el manager;
// vender en la puerta y controlar los QR también el RRPP.
const equipoCompleto = soloRoles(SUPERADMIN, ADMIN, MANAGER, RRPP);
const gestionaPagos = soloRoles(SUPERADMIN, ADMIN, MANAGER);
delBoliche.get("/eventos/:idEvento/ventas", listarVentas);
delBoliche.put("/compras/:idCompra/pagar", gestionaPagos, pagarCompra);
delBoliche.put("/compras/:idCompra/cancelar", gestionaPagos, cancelarCompra);
delBoliche.post("/eventos/:idEvento/venta-puerta", equipoCompleto, ventaPuerta);
delBoliche.post("/eventos/:idEvento/puerta/escanear", equipoCompleto, escanear);
delBoliche.post("/eventos/:idEvento/puerta/buscar", equipoCompleto, buscarPorDni);
delBoliche.post("/eventos/:idEvento/puerta/reingreso", equipoCompleto, reingreso);
delBoliche.get("/eventos/:idEvento/puerta/resumen", equipoCompleto, resumenPuerta);
delBoliche.get("/eventos/:idEvento/puerta/accesos", equipoCompleto, ultimosAccesos);

// Flyer del evento: lo cambia quien puede editar el evento (el manager, solo los suyos).
delBoliche.post("/eventos/:idEvento/imagen", soloRoles(SUPERADMIN, ADMIN, MANAGER), recibirImagen, subirImagenEvento);
delBoliche.delete("/eventos/:idEvento/imagen", soloRoles(SUPERADMIN, ADMIN, MANAGER), borrarImagenEvento);

router.use("/:idBoliche", delBoliche);

export default router;
