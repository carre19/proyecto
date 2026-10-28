"""Pruebas de la fase 2: compra de entradas con nombre, apellido y DNI, cupos, QR de un solo uso, venta en la puerta
y control de acceso. Corre contra una base RECIÉN cargada y con el backend levantado:
    API=http://localhost:3000/api python3 pruebas/api_fase2.py
(con PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE también prueba los vencimientos, que necesitan tocar la base)."""
import re, threading
from comun import chk, entrar, fin, pedir, saltear, sql, verdad

TS, _ = entrar("superadmin@demo.com"); TA1, UA1 = entrar("admin1@demo.com"); TA2, _ = entrar("admin2@demo.com")
TM, _ = entrar("manager1@demo.com"); TR1, _ = entrar("rrpp1@demo.com"); TR2, _ = entrar("rrpp2@demo.com"); TC, UC = entrar("cliente@demo.com")
ids = {b["nombre"]: b["id_boliche"] for b in UA1["boliches"]}; U = ids["Boliche Uno"]; D = ids["Bar Dos"]
pub = pedir("GET", "/publico/boliches/boliche-uno")[1]
EV = next(e for e in pub["eventos"] if e["nombre"] == "Noche Electrónica"); RETRO = next(e for e in pub["eventos"] if e["nombre"] == "Fiesta Retro")
tipo = lambda ev, nombre: next(t for t in ev["entradas"] if t["nombre"] == nombre)
T2 = tipo(EV, "Tanda 2")["id_tipo_entrada"]; T1 = tipo(EV, "Tanda 1")["id_tipo_entrada"]; T3 = tipo(EV, "Tanda 3")["id_tipo_entrada"]; VIP = tipo(EV, "VIP")["id_tipo_entrada"]
GENERAL = tipo(RETRO, "General")["id_tipo_entrada"]
ruta = lambda ev, fin_: f"/publico/boliches/boliche-uno/eventos/{ev['id_evento']}/{fin_}"
persona = lambda dni, tipo_id=T2, nombre="Ana", apellido="Pérez": {"id_tipo_entrada": tipo_id, "nombre": nombre, "apellido": apellido, "dni": str(dni)}
CONTACTO = {"contacto_email": "ana@mail.com"}
_dni = [30000000]
def dni_nuevo():
    _dni[0] += 1
    return _dni[0]

# ---------------------------------------------------------------------------------------------------------
print("== Comprar desde la página (sin cuenta) ==")
c = chk("2 entradas de la Tanda 2: pendiente, con precio virtual + 6 % de la plataforma", pedir("POST", ruta(EV, "comprar"), {"items": [persona(dni_nuevo()), persona(dni_nuevo(), nombre="Beto")], **CONTACTO}), 201,
        lambda d: d["estado"] == "pendiente" and d["subtotal"] == 20000 and d["cargo_plataforma"] == 1200 and d["total"] == 21200 and len(d["entradas"]) == 2 and d["vence_en"])
verdad("la referencia para la transferencia tiene el formato NX + 6 caracteres", bool(re.fullmatch(r"NX[A-Z0-9]{6}", c["referencia"])))
verdad("sin pagar NO se muestran los códigos QR", all("codigo" not in e for e in c["entradas"]) and all(e["estado"] == "pendiente" for e in c["entradas"]))
chk("se puede ver la compra con el link (token)", pedir("GET", f"/publico/compras/{c['token_publico']}"), 200, lambda d: d["estado"] == "pendiente" and d["boliche"] == "Boliche Uno" and "codigo" not in d["entradas"][0])
chk("un token que no existe -> 404", pedir("GET", "/publico/compras/" + "0" * 40), 404)

print("== Validaciones de la compra ==")
malo = lambda nombre, cuerpo, codigo=400: chk(nombre, pedir("POST", ruta(EV, "comprar"), cuerpo), codigo)
malo("sin contacto (ni teléfono ni email)", {"items": [persona(dni_nuevo())]})
malo("email inválido", {"items": [persona(dni_nuevo())], "contacto_email": "no-es-email"})
chk("con solo teléfono alcanza", pedir("POST", ruta(EV, "comprar"), {"items": [persona(dni_nuevo())], "contacto_telefono": "351 555 1234"}), 201)
malo("sin entradas", {"items": [], **CONTACTO})
malo("sin lista de entradas", {**CONTACTO})
malo("DNI con letras", {"items": [persona("12ab5678")], **CONTACTO})
malo("DNI muy corto", {"items": [persona("12345")], **CONTACTO})
malo("sin nombre", {"items": [{"id_tipo_entrada": T2, "apellido": "X", "dni": str(dni_nuevo())}], **CONTACTO})
malo("sin apellido", {"items": [{"id_tipo_entrada": T2, "nombre": "X", "dni": str(dni_nuevo())}], **CONTACTO})
d1 = dni_nuevo()
malo("el mismo DNI dos veces en la compra (la entrada es personal)", {"items": [persona(d1), persona(d1)], **CONTACTO})
malo("más de 10 entradas por compra", {"items": [persona(dni_nuevo()) for _ in range(11)], **CONTACTO})
malo("una entrada de OTRO evento", {"items": [persona(dni_nuevo(), GENERAL)], **CONTACTO})
malo("un tipo de entrada que no existe", {"items": [persona(dni_nuevo(), 999999)], **CONTACTO})
malo("entrada agotada (Tanda 1) -> 409", {"items": [persona(dni_nuevo(), T1)], **CONTACTO}, 409)
malo("entrada no disponible (Tanda 3) -> 409", {"items": [persona(dni_nuevo(), T3)], **CONTACTO}, 409)
chk("evento que no existe -> 404", pedir("POST", "/publico/boliches/boliche-uno/eventos/999999/comprar", {"items": [persona(dni_nuevo())], **CONTACTO}), 404)
chk("evento de OTRO boliche con la dirección de este -> 404", pedir("POST", f"/publico/boliches/bar-dos/eventos/{EV['id_evento']}/comprar", {"items": [persona(dni_nuevo())], **CONTACTO}), 404)
chk("boliche que no existe -> 404", pedir("POST", "/publico/boliches/no-existe/eventos/1/comprar", {"items": [persona(dni_nuevo())], **CONTACTO}), 404)
chk("token inválido en la compra -> 401 (no se ignora en silencio)", pedir("POST", ruta(EV, "comprar"), {"items": [persona(dni_nuevo())], **CONTACTO}, "token-falso"), 401)
dup = chk("el mismo DNI ya tiene una entrada vigente para el evento -> 409 con el DNI", pedir("POST", ruta(EV, "comprar"), {"items": [persona(c["entradas"][0]["dni"])], **CONTACTO}), 409, lambda d: c["entradas"][0]["dni"] in d["mensaje"])

# ---------------------------------------------------------------------------------------------------------
print("== Cupos: agotarse solo, liberarse al cancelar ==")
mini = chk("el admin crea una entrada de cupo 3 para Fiesta Retro", pedir("POST", f"/boliches/{U}/eventos/{RETRO['id_evento']}/entradas", {"nombre": "Mini", "precio_virtual": 1000, "precio_puerta": 2000, "cupo": 3}, TA1), 201)
MINI = mini["id_tipo_entrada"]
ruta_r = lambda f: ruta(RETRO, f)
tres = chk("comprar las 3 de golpe", pedir("POST", ruta_r("comprar"), {"items": [persona(dni_nuevo(), MINI) for _ in range(3)], **CONTACTO}), 201)
chk("la entrada se marcó AGOTADA sola", pedir("GET", f"/boliches/{U}/eventos/{RETRO['id_evento']}/entradas", None, TA1), 200, lambda d: next(t for t in d if t["id_tipo_entrada"] == MINI)["estado"] == "agotada")
chk("ya no se puede comprar -> 409", pedir("POST", ruta_r("comprar"), {"items": [persona(dni_nuevo(), MINI)], **CONTACTO}), 409)
chk("subir el cupo a 2 (menos de lo vendido) se rechaza", pedir("PUT", f"/boliches/{U}/eventos/{RETRO['id_evento']}/entradas/{MINI}", {"cupo": 2}, TA1), 400, lambda d: "vendidas" in d["mensaje"])
chk("el admin cancela la compra pendiente", pedir("PUT", f"/boliches/{U}/compras/{tres['id_compra']}/cancelar", None, TA1), 200)
chk("al liberarse el cupo vuelve a estar DISPONIBLE", pedir("GET", f"/boliches/{U}/eventos/{RETRO['id_evento']}/entradas", None, TA1), 200, lambda d: next(t for t in d if t["id_tipo_entrada"] == MINI)["estado"] == "disponible")
chk("y se puede volver a comprar", pedir("POST", ruta_r("comprar"), {"items": [persona(dni_nuevo(), MINI), persona(dni_nuevo(), MINI)], **CONTACTO}), 201)
chk("una entrada con ventas no se puede borrar -> 409", pedir("DELETE", f"/boliches/{U}/eventos/{RETRO['id_evento']}/entradas/{MINI}", None, TA1), 409, lambda d: "vendieron" in d["mensaje"])
chk("un evento con ventas no se puede borrar -> 409", pedir("DELETE", f"/boliches/{U}/eventos/{RETRO['id_evento']}", None, TA1), 409, lambda d: "ventas" in d["mensaje"])

print("== Compras al mismo tiempo no pasan el cupo ==")
conc = chk("cupo 3 para probar la concurrencia", pedir("POST", f"/boliches/{U}/eventos/{RETRO['id_evento']}/entradas", {"nombre": "Carrera", "precio_virtual": 1000, "precio_puerta": 2000, "cupo": 3}, TA1), 201)
resultados = []
def comprar_uno(i):
    resultados.append(pedir("POST", ruta_r("comprar"), {"items": [persona(40000000 + i, conc["id_tipo_entrada"])], **CONTACTO})[0])
hilos = [threading.Thread(target=comprar_uno, args=(i,)) for i in range(8)]
[h.start() for h in hilos]; [h.join() for h in hilos]
verdad(f"8 compras a la vez por 3 entradas: se aceptan exactamente 3 (aceptadas: {resultados.count(201)})", resultados.count(201) == 3 and resultados.count(409) == 5)

# ---------------------------------------------------------------------------------------------------------
print("== Confirmar el pago y recibir el QR ==")
chk("el cliente no puede confirmar pagos (no es de la plataforma)", pedir("PUT", f"/boliches/{U}/compras/{c['id_compra']}/pagar", None, TC), 403)
chk("el RRPP no confirma pagos", pedir("PUT", f"/boliches/{U}/compras/{c['id_compra']}/pagar", None, TR1), 403)
chk("el admin de otro boliche -> 404", pedir("PUT", f"/boliches/{U}/compras/{c['id_compra']}/pagar", None, TA2), 404)
chk("una compra que no existe -> 404", pedir("PUT", f"/boliches/{U}/compras/999999/pagar", None, TA1), 404)
chk("el admin confirma el pago", pedir("PUT", f"/boliches/{U}/compras/{c['id_compra']}/pagar", None, TA1), 200, lambda d: d["estado"] == "pagada" and all(e["estado"] == "valida" for e in d["entradas"]))
pagada = chk("con el link ahora se ven los QR", pedir("GET", f"/publico/compras/{c['token_publico']}"), 200, lambda d: d["estado"] == "pagada" and all(re.fullmatch(r"[0-9a-f]{32}", e["codigo"]) for e in d["entradas"]))
chk("confirmar dos veces -> 409", pedir("PUT", f"/boliches/{U}/compras/{c['id_compra']}/pagar", None, TA1), 409)
chk("una entrada ya pagada NO se devuelve (cancelar -> 409)", pedir("PUT", f"/boliches/{U}/compras/{c['id_compra']}/cancelar", None, TA1), 409, lambda d: "no se devuelve" in d["mensaje"])
c2 = pedir("POST", ruta(EV, "comprar"), {"items": [persona(dni_nuevo())], **CONTACTO})[1]
chk("el manager también confirma pagos", pedir("PUT", f"/boliches/{U}/compras/{c2['id_compra']}/pagar", None, TM), 200)
verdad("los códigos de las entradas son distintos", len({e["codigo"] for e in pagada["entradas"]}) == len(pagada["entradas"]))

print("== Cuenta del cliente (opcional) ==")
cc = chk("el cliente con sesión compra y la compra queda en su cuenta", pedir("POST", ruta(EV, "comprar"), {"items": [persona(dni_nuevo(), VIP, "Cora", "Cliente")], **CONTACTO}, TC), 201)
chk("el cliente ve sus compras", pedir("GET", "/cliente/compras", None, TC), 200, lambda d: len(d) == 1 and d[0]["id_compra"] == cc["id_compra"] and d[0]["evento"] == "Noche Electrónica")
otro, _ = pedir("POST", "/auth/register", {"nombre": "Otro", "apellido": "Cliente", "email": "otro@cliente.com", "password": "clave12345"}), 0
TO, _ = entrar("otro@cliente.com", "clave12345")
chk("otro cliente NO ve las compras del primero", pedir("GET", "/cliente/compras", None, TO), 200, lambda d: d == [])
chk("el personal del boliche no usa la cuenta de cliente -> 403", pedir("GET", "/cliente/compras", None, TA1), 403)
chk("sin sesión -> 401", pedir("GET", "/cliente/compras"), 401)

# ---------------------------------------------------------------------------------------------------------
print("== Venta en la puerta ==")
vp = lambda ev, cuerpo, tk: pedir("POST", f"/boliches/{U}/eventos/{ev['id_evento']}/venta-puerta", cuerpo, tk)
v = chk("el RRPP vende en puerta con efectivo: precio de puerta, sin cargo, ya pagada y con QR", vp(EV, {"items": [persona(dni_nuevo(), T2, "Pablo", "Puerta")], "metodo_pago": "efectivo"}, TR1), 201,
        lambda d: d["estado"] == "pagada" and d["total"] == 12000 and d["cargo_plataforma"] == 0 and d["entradas"][0]["estado"] == "valida" and d["entradas"][0].get("codigo") and d["canal"] == "puerta")
chk("venta en puerta por QR", vp(EV, {"items": [persona(dni_nuevo(), T2)], "metodo_pago": "qr"}, TA1), 201)
chk("venta en puerta por transferencia", vp(EV, {"items": [persona(dni_nuevo(), T2)], "metodo_pago": "transferencia"}, TM), 201)
chk("método de pago inválido", vp(EV, {"items": [persona(dni_nuevo())], "metodo_pago": "bitcoin"}, TA1), 400)
chk("sin método de pago", vp(EV, {"items": [persona(dni_nuevo())]}, TA1), 400)
chk("el cliente no vende -> 403", vp(EV, {"items": [persona(dni_nuevo())], "metodo_pago": "efectivo"}, TC), 403)
chk("el admin de otro boliche -> 404", vp(EV, {"items": [persona(dni_nuevo())], "metodo_pago": "efectivo"}, TA2), 404)
chk("también respeta el cupo (entrada agotada)", vp(EV, {"items": [persona(dni_nuevo(), T1)], "metodo_pago": "efectivo"}, TA1), 409)
chk("y el DNI único por evento", vp(EV, {"items": [persona(v["entradas"][0]["dni"])], "metodo_pago": "efectivo"}, TA1), 409)

print("== Quién ve qué ventas (y el DNI) ==")
ventas = lambda tk, ev=EV, q="": pedir("GET", f"/boliches/{U}/eventos/{ev['id_evento']}/ventas{q}", None, tk)
va = chk("el admin ve todas las ventas del evento con el resumen", ventas(TA1), 200, lambda d: d["resumen"]["compras"] >= 6 and d["resumen"]["entradas_pagadas"] >= 5)
verdad("el admin ve el DNI completo", any(re.fullmatch(r"\d{8}", e["dni"]) for cp in va["compras"] for e in cp["entradas"]))
chk("el RRPP ve SOLO sus ventas", ventas(TR1), 200, lambda d: len(d["compras"]) == 1 and d["compras"][0]["entradas"][0]["nombre"] == "Pablo" and d["resumen"]["compras"] == 1)
verdad("el RRPP ve el nombre y el DNI de quien pagó", re.fullmatch(r"\d{8}", ventas(TR1)[1]["compras"][0]["entradas"][0]["dni"]) is not None)
chk("el superadmin ve las ventas pero el DNI va enmascarado", ventas(TS), 200, lambda d: all(e["dni"].startswith("*") for cp in d["compras"] for e in cp["entradas"]))
chk("el manager ve lo de su equipo y lo que vendió él", ventas(TM), 200, lambda d: {cp["canal"] for cp in d["compras"]} == {"puerta"} and len(d["compras"]) == 2)
chk("filtro por estado pendiente", ventas(TA1, EV, "?estado=pendiente"), 200, lambda d: all(cp["estado"] == "pendiente" for cp in d["compras"]) and len(d["compras"]) >= 1)
chk("el cliente no ve ventas -> 403", ventas(TC), 403)
chk("el admin de otro boliche -> 404", ventas(TA2), 404)
chk("otro RRPP del mismo boliche NO ve las ventas de su compañero", ventas(TR2), 200, lambda d: d["compras"] == [] and d["resumen"]["compras"] == 0)

# ---------------------------------------------------------------------------------------------------------
print("== Control en la puerta: cada QR sirve una sola vez ==")
P = lambda ev, f, cuerpo=None, tk=TA1, m="POST": pedir(m, f"/boliches/{U}/eventos/{ev['id_evento']}/puerta/{f}", cuerpo, tk)
cod = pagada["entradas"][0]["codigo"]; cod2 = pagada["entradas"][1]["codigo"]
chk("entra con un QR válido y devuelve nombre y DNI", P(EV, "escanear", {"codigo": cod}), 200, lambda d: d["resultado"] == "ingreso" and d["entrada"]["nombre"] == "Ana" and d["entrada"]["dni"] == pagada["entradas"][0]["dni"])
chk("el mismo QR otra vez se RECHAZA (ya usado)", P(EV, "escanear", {"codigo": cod}), 409, lambda d: d["resultado"] == "rechazada_usada" and d["entrada"]["usada_en"])
chk("un código desconocido -> 404", P(EV, "escanear", {"codigo": "a" * 32}), 404, lambda d: d["resultado"] == "no_encontrada")
chk("un código con formato inválido -> 400", P(EV, "escanear", {"codigo": "hola"}), 400)
chk("sin código -> 400", P(EV, "escanear", {}), 400)
chk("el código en mayúsculas y con espacios también vale", P(EV, "escanear", {"codigo": "  " + cod2.upper() + " "}), 200)
chk("una entrada de OTRO evento del mismo boliche se rechaza", P(RETRO, "escanear", {"codigo": v["entradas"][0]["codigo"]}), 409, lambda d: d["resultado"] == "rechazada_otro_evento")
chk("el RRPP controla el QR", P(EV, "escanear", {"codigo": v["entradas"][0]["codigo"]}, TR1), 200)
chk("el manager controla el QR", P(EV, "escanear", {"codigo": pedir("POST", f"/boliches/{U}/eventos/{EV['id_evento']}/venta-puerta", {"items": [persona(dni_nuevo())], "metodo_pago": "efectivo"}, TA1)[1]["entradas"][0]["codigo"]}, TM), 200)
chk("el cliente no controla -> 403", P(EV, "escanear", {"codigo": cod}, TC), 403)
chk("el admin de otro boliche -> 404", P(EV, "escanear", {"codigo": cod}, TA2), 404)
chk("sin sesión -> 401", P(EV, "escanear", {"codigo": cod}, None), 401)

# una entrada de OTRO boliche no se puede validar en este
ev_dos = pedir("GET", "/publico/boliches/bar-dos")[1]["eventos"][0]
td = chk("el admin crea una entrada en Bar Dos", pedir("POST", f"/boliches/{D}/eventos/{ev_dos['id_evento']}/entradas", {"nombre": "General", "precio_virtual": 5000, "precio_puerta": 6000, "cupo": 10}, TA1), 201)
vd = chk("venta en puerta en Bar Dos", pedir("POST", f"/boliches/{D}/eventos/{ev_dos['id_evento']}/venta-puerta", {"items": [persona(dni_nuevo(), td["id_tipo_entrada"])], "metodo_pago": "efectivo"}, TA1), 201)
chk("el QR de Bar Dos NO sirve en Boliche Uno (se trata como inexistente)", P(EV, "escanear", {"codigo": vd["entradas"][0]["codigo"]}), 404)

print("== Escaneos simultáneos del mismo QR ==")
nuevo = pedir("POST", f"/boliches/{U}/eventos/{EV['id_evento']}/venta-puerta", {"items": [persona(dni_nuevo())], "metodo_pago": "efectivo"}, TA1)[1]["entradas"][0]
res = []
def escanear_ya():
    res.append(P(EV, "escanear", {"codigo": nuevo["codigo"]})[0])
hs = [threading.Thread(target=escanear_ya) for _ in range(6)]
[h.start() for h in hs]; [h.join() for h in hs]
verdad(f"6 personas escanean el mismo QR a la vez: entra una sola (entradas: {res.count(200)})", res.count(200) == 1 and res.count(409) == 5)

print("== Sin pagar no se entra / búsqueda por DNI / reingreso ==")
pend = pedir("POST", ruta(EV, "comprar"), {"items": [persona(dni_nuevo())], **CONTACTO})[1]
codigo_pend = sql(f"SELECT codigo FROM entrada WHERE id_compra = {pend['id_compra']}")
if codigo_pend:
    chk("una entrada sin pagar se rechaza", P(EV, "escanear", {"codigo": codigo_pend}), 409, lambda d: d["resultado"] == "rechazada_no_pagada")
else:
    saltear("una entrada sin pagar se rechaza")
bd = pagada["entradas"][0]["dni"]
chk("buscar por DNI devuelve la entrada y su estado", P(EV, "buscar", {"dni": bd}), 200, lambda d: len(d) == 1 and d[0]["estado"] == "usada" and d[0]["dni"] == bd)
chk("DNI inválido -> 400", P(EV, "buscar", {"dni": "12"}), 400)
chk("DNI sin entradas -> lista vacía", P(EV, "buscar", {"dni": "11111111"}), 200, lambda d: d == [])
chk("reingreso de quien ya entró (DNI verificado a mano)", P(EV, "reingreso", {"id_entrada": pagada["entradas"][0]["id_entrada"]}), 200, lambda d: d["resultado"] == "reingreso")
chk("reingreso de quien todavía NO entró -> 409", P(EV, "reingreso", {"id_entrada": v["entradas"][0]["id_entrada"] + 0 if False else pedir("POST", f"/boliches/{U}/eventos/{EV['id_evento']}/venta-puerta", {"items": [persona(dni_nuevo())], "metodo_pago": "efectivo"}, TA1)[1]["entradas"][0]["id_entrada"]}), 409)
chk("reingreso con id inválido -> 400", P(EV, "reingreso", {"id_entrada": "x"}), 400)
resumen = chk("resumen de la puerta", P(EV, "resumen", None, TA1, "GET"), 200, lambda d: d["ingresaron"] >= 4 and d["pagadas"] > d["ingresaron"] and d["capacidad"] == 800)
chk("últimos accesos con quién los registró", P(EV, "accesos", None, TA1, "GET"), 200, lambda d: len(d) >= 8 and any(a["resultado"] == "ingreso" for a in d) and any(a["resultado"] == "rechazada_usada" for a in d) and any(a["resultado"] == "reingreso" for a in d) and d[0]["registrado_por"])

# ---------------------------------------------------------------------------------------------------------
print("== Compras vencidas liberan el cupo ==")
if sql("SELECT 1"):
    pv = pedir("POST", ruta(EV, "comprar"), {"items": [persona(dni_nuevo())], **CONTACTO})[1]
    sql(f"UPDATE compra SET vence_en = now() - interval '1 minute' WHERE id_compra = {pv['id_compra']}")
    chk("al pasar el tiempo la compra se cancela sola", pedir("GET", f"/publico/compras/{pv['token_publico']}"), 200, lambda d: d["estado"] == "cancelada" and all(e["estado"] == "anulada" for e in d["entradas"]))
    chk("y el DNI queda libre para comprar de nuevo", pedir("POST", ruta(EV, "comprar"), {"items": [persona(pv["entradas"][0]["dni"])], **CONTACTO}), 201)
    pv2 = pedir("POST", ruta(EV, "comprar"), {"items": [persona(dni_nuevo())], **CONTACTO})[1]
    sql(f"UPDATE compra SET vence_en = now() - interval '1 minute' WHERE id_compra = {pv2['id_compra']}")
    chk("una compra vencida ya no se puede confirmar -> 409", pedir("PUT", f"/boliches/{U}/compras/{pv2['id_compra']}/pagar", None, TA1), 409, lambda d: "venci" in d["mensaje"])
else:
    saltear("vencimiento de compras")

fin()
