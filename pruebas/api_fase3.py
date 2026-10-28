"""Pruebas de la fase 3: cuenta de cobro, confirmación automática de transferencias (webhook firmado), pagos a revisar,
reactivación de compras vencidas, avisos al cliente y el cargo de la plataforma.
El backend tiene que correr con PAGOS_WEBHOOK_SECRET=secreto-de-prueba (o el valor de la variable de entorno del mismo nombre):
    PAGOS_WEBHOOK_SECRET=secreto-de-prueba npm start
    API=http://localhost:3000/api python3 pruebas/api_fase3.py"""
import hashlib, hmac, json, os, time
from comun import chk, entrar, fin, pedir, saltear, sql, verdad

SECRETO = os.environ.get("PAGOS_WEBHOOK_SECRET", "secreto-de-prueba")
TS, _ = entrar("superadmin@demo.com"); TA1, UA1 = entrar("admin1@demo.com"); TA2, UA2 = entrar("admin2@demo.com")
TM, _ = entrar("manager1@demo.com"); TR1, _ = entrar("rrpp1@demo.com"); TC, _ = entrar("cliente@demo.com")
ids = {b["nombre"]: b["id_boliche"] for b in UA1["boliches"]}; U = ids["Boliche Uno"]; D = ids["Bar Dos"]; T3 = UA2["boliches"][0]["id_boliche"]
pub = pedir("GET", "/publico/boliches/boliche-uno")[1]
EV = next(e for e in pub["eventos"] if e["nombre"] == "Noche Electrónica"); RETRO = next(e for e in pub["eventos"] if e["nombre"] == "Fiesta Retro")
TANDA2 = next(t for t in EV["entradas"] if t["nombre"] == "Tanda 2")["id_tipo_entrada"]
ruta = lambda ev, f: f"/publico/boliches/boliche-uno/eventos/{ev['id_evento']}/{f}"
_dni = [50000000]
def persona(tipo=TANDA2, nombre="Ana"):
    _dni[0] += 1
    return {"id_tipo_entrada": tipo, "nombre": nombre, "apellido": "Pérez", "dni": str(_dni[0])}
def comprar(ev=EV, tipo=TANDA2, contacto=None, n=1):
    return chk("compra pendiente", pedir("POST", ruta(ev, "comprar"), {"items": [persona(tipo) for _ in range(n)], **(contacto or {"contacto_email": "ana@mail.com", "contacto_telefono": "351 555 0000"})}), 201)

def avisar(referencia, monto, operacion, firmar=True, cuerpo=None):
    """Simula el aviso del banco: POST firmado con HMAC-SHA256 sobre el cuerpo exacto."""
    datos = json.dumps(cuerpo if cuerpo is not None else {"referencia": referencia, "monto": monto, "id_operacion": operacion}).encode()
    firma = hmac.new(SECRETO.encode(), datos, hashlib.sha256).hexdigest() if firmar else "00" * 32
    return pedir("POST", "/pagos/webhook", datos, None, "application/json", {"X-Firma": firma})

# ---------------------------------------------------------------------------------------------------------
print("== Cuenta de cobro del boliche ==")
chk("el admin ve la cuenta de cobro", pedir("GET", f"/boliches/{U}/cuenta-cobro", None, TA1), 200, lambda d: d["alias"] == "boliche.uno.mp" and d["titular"])
chk("el manager también la ve", pedir("GET", f"/boliches/{U}/cuenta-cobro", None, TM), 200)
chk("el RRPP no gestiona pagos -> 403", pedir("GET", f"/boliches/{U}/cuenta-cobro", None, TR1), 403)
chk("el cliente -> 403", pedir("GET", f"/boliches/{U}/cuenta-cobro", None, TC), 403)
chk("el admin de otro boliche -> 404", pedir("GET", f"/boliches/{U}/cuenta-cobro", None, TA2), 404)
chk("el admin cambia la cuenta", pedir("PUT", f"/boliches/{U}/cuenta-cobro", {"titular": "Boliche Uno S.R.L.", "banco": "Banco Nación", "alias": "uno.nuevo.cobros"}, TA1), 200, lambda d: d["alias"] == "uno.nuevo.cobros" and d["banco"] == "Banco Nación")
chk("con CBU válido", pedir("PUT", f"/boliches/{U}/cuenta-cobro", {"titular": "Boliche Uno S.R.L.", "alias": "uno.nuevo.cobros", "cbu": "0110000000000000000022"}, TA1), 200)
chk("sin titular -> 400", pedir("PUT", f"/boliches/{U}/cuenta-cobro", {"alias": "x.y.z"}, TA1), 400)
chk("sin alias ni CBU -> 400", pedir("PUT", f"/boliches/{U}/cuenta-cobro", {"titular": "X"}, TA1), 400)
chk("CBU con 5 números -> 400", pedir("PUT", f"/boliches/{U}/cuenta-cobro", {"titular": "X", "cbu": "12345"}, TA1), 400)
chk("el manager NO cambia la cuenta -> 403", pedir("PUT", f"/boliches/{U}/cuenta-cobro", {"titular": "X", "alias": "a.b.c"}, TM), 403)
chk("el admin de otro boliche NO la cambia -> 404", pedir("PUT", f"/boliches/{U}/cuenta-cobro", {"titular": "X", "alias": "a.b.c"}, TA2), 404)

print("== A dónde transferir ==")
c = comprar()
chk("la compra pendiente muestra la cuenta para transferir", pedir("GET", f"/publico/compras/{c['token_publico']}"), 200, lambda d: d["cuenta_cobro"]["alias"] == "uno.nuevo.cobros" and d["cuenta_cobro"]["titular"])
chk("el boliche declara que acepta pagos online", pedir("GET", "/publico/boliches/boliche-uno"), 200, lambda d: d["acepta_pagos_online"] is True)
chk("Club Tres no tiene cuenta: no acepta pagos online", pedir("GET", "/publico/boliches/club-tres"), 200, lambda d: d["acepta_pagos_online"] is False)
ev3 = pedir("GET", "/publico/boliches/club-tres")[1]["eventos"][0]
t3 = chk("el admin de Club Tres crea una entrada", pedir("POST", f"/boliches/{T3}/eventos/{ev3['id_evento']}/entradas", {"nombre": "General", "precio_virtual": 4000, "precio_puerta": 5000, "cupo": 5}, TA2), 201)
chk("sin cuenta de cobro no se vende online -> 409", pedir("POST", f"/publico/boliches/club-tres/eventos/{ev3['id_evento']}/comprar", {"items": [persona(t3["id_tipo_entrada"])], "contacto_email": "a@b.com"}), 409, lambda d: "puerta" in d["mensaje"])
chk("el admin de Club Tres carga su cuenta", pedir("PUT", f"/boliches/{T3}/cuenta-cobro", {"titular": "Club Tres", "alias": "club.tres.mp"}, TA2), 200)
chk("ahora sí se vende", pedir("POST", f"/publico/boliches/club-tres/eventos/{ev3['id_evento']}/comprar", {"items": [persona(t3["id_tipo_entrada"])], "contacto_email": "a@b.com"}), 201)

print("== Cargo de la plataforma (6 %, lo paga el cliente) ==")
raro = chk("entrada de precio raro para probar el redondeo", pedir("POST", f"/boliches/{U}/eventos/{RETRO['id_evento']}/entradas", {"nombre": "Raro", "precio_virtual": 1990, "precio_puerta": 2500, "cupo": 5}, TA1), 201)
r = chk("1990 + 6 % (119,4 se redondea para arriba a 120) = 2110", pedir("POST", ruta(RETRO, "comprar"), {"items": [persona(raro["id_tipo_entrada"])], "contacto_email": "a@b.com"}), 201, lambda d: d["cargo_plataforma"] == 120 and d["total"] == 2110)

# ---------------------------------------------------------------------------------------------------------
print("== Confirmación automática: el aviso del banco ==")
chk("sin firma -> 401", avisar(c["referencia"], c["total"], "OP-1", firmar=False), 401)
chk("firma de otro cuerpo -> 401", pedir("POST", "/pagos/webhook", json.dumps({"referencia": c["referencia"], "monto": c["total"], "id_operacion": "OP-1"}).encode(), None, "application/json", {"X-Firma": hmac.new(b"otro-secreto", b"{}", hashlib.sha256).hexdigest()}), 401)
chk("la compra sigue pendiente después de los intentos falsos", pedir("GET", f"/publico/compras/{c['token_publico']}"), 200, lambda d: d["estado"] == "pendiente")
chk("referencia con formato inválido -> 400", avisar("hola", 100, "OP-2"), 400)
chk("monto inválido -> 400", avisar(c["referencia"], -5, "OP-3"), 400)
chk("sin id de operación -> 400", avisar(c["referencia"], 100, ""), 400)
chk("referencia que no existe -> 404", avisar("NXAAAAAA", 100, "OP-4"), 404)

ok = chk("llega la transferencia exacta (referencia en minúsculas): la compra se confirma sola", avisar(c["referencia"].lower(), c["total"], "OP-100"), 200, lambda d: d["resultado"] == "confirmado")
chk("ahora tiene los QR", pedir("GET", f"/publico/compras/{c['token_publico']}"), 200, lambda d: d["estado"] == "pagada" and all(e.get("codigo") for e in d["entradas"]))
chk("el aviso repetido de la misma operación se ignora", avisar(c["referencia"], c["total"], "OP-100"), 200, lambda d: d.get("duplicado") is True)
pagos = chk("queda registrado el pago automático", pedir("GET", f"/boliches/{U}/pagos?estado=confirmado", None, TA1), 200, lambda d: any(p["id_operacion"] == "OP-100" and p["origen"] == "automatico" and p["monto"] == c["total"] for p in d))
chk("pago repetido de una compra ya paga (otra operación) -> a revisar", avisar(c["referencia"], c["total"], "OP-101"), 200, lambda d: d["resultado"] == "a_revisar" and "repetido" in d["motivo"])

print("== Pagos que hay que revisar ==")
c2 = comprar()
chk("monto insuficiente: queda a revisar y la compra sigue pendiente", avisar(c2["referencia"], c2["total"] - 500, "OP-200"), 200, lambda d: d["resultado"] == "a_revisar" and "insuficiente" in d["motivo"])
chk("la compra NO se confirmó", pedir("GET", f"/publico/compras/{c2['token_publico']}"), 200, lambda d: d["estado"] == "pendiente")
rev = chk("el admin ve los pagos a revisar", pedir("GET", f"/boliches/{U}/pagos?estado=a_revisar", None, TA1), 200, lambda d: len(d) == 2)
pid = next(p["id_pago"] for p in rev if p["id_operacion"] == "OP-200")
chk("el RRPP no ve pagos -> 403", pedir("GET", f"/boliches/{U}/pagos", None, TR1), 403)
chk("el admin de otro boliche no ve pagos -> 404", pedir("GET", f"/boliches/{U}/pagos", None, TA2), 404)
chk("el manager resuelve un pago a revisar", pedir("PUT", f"/boliches/{U}/pagos/{pid}/resolver", {"detalle": "Se devolvió la diferencia"}, TM), 200)
chk("resolverlo otra vez -> 409", pedir("PUT", f"/boliches/{U}/pagos/{pid}/resolver", {}, TM), 409)
chk("queda como resuelto con la nota", pedir("GET", f"/boliches/{U}/pagos?estado=resuelto", None, TA1), 200, lambda d: any(p["id_pago"] == pid and "devolvió" in p["detalle"] for p in d))
chk("un pago de otro boliche no se resuelve desde este -> 404", pedir("PUT", f"/boliches/{D}/pagos/{pid}/resolver", {}, TA1), 404)
c3 = comprar()
chk("pagar de más confirma y deja la nota", avisar(c3["referencia"], c3["total"] + 300, "OP-300"), 200, lambda d: d["resultado"] == "confirmado")
chk("... con el detalle de lo que sobró", pedir("GET", f"/boliches/{U}/pagos?estado=confirmado", None, TA1), 200, lambda d: any(p["id_operacion"] == "OP-300" and "de más" in (p["detalle"] or "") for p in d))

print("== Pago que llega tarde: se reactiva la compra ==")
if sql("SELECT 1"):
    c4 = comprar()
    sql(f"UPDATE compra SET vence_en = now() - interval '1 minute' WHERE id_compra = {c4['id_compra']}")
    pedir("GET", f"/publico/compras/{c4['token_publico']}")  # esta consulta ya la cancela por vencida
    chk("llega el pago de una compra vencida: queda a revisar", avisar(c4["referencia"], c4["total"], "OP-400"), 200, lambda d: d["resultado"] == "a_revisar" and "vencida" in d["motivo"])
    pid4 = next(p["id_pago"] for p in pedir("GET", f"/boliches/{U}/pagos?estado=a_revisar", None, TA1)[1] if p["id_operacion"] == "OP-400")
    chk("el admin la reactiva: la compra queda paga con sus QR", pedir("PUT", f"/boliches/{U}/pagos/{pid4}/reactivar", None, TA1), 200)
    chk("la compra reactivada tiene los QR", pedir("GET", f"/publico/compras/{c4['token_publico']}"), 200, lambda d: d["estado"] == "pagada" and all(e.get("codigo") for e in d["entradas"]))
    # otra persona tomó el DNI mientras tanto
    c5 = comprar()
    sql(f"UPDATE compra SET vence_en = now() - interval '1 minute' WHERE id_compra = {c5['id_compra']}")
    pedir("GET", f"/publico/compras/{c5['token_publico']}")
    avisar(c5["referencia"], c5["total"], "OP-500")
    chk("el DNI de la compra vencida lo toma otra persona", pedir("POST", ruta(EV, "comprar"), {"items": [{"id_tipo_entrada": TANDA2, "nombre": "Otra", "apellido": "Persona", "dni": c5["entradas"][0]["dni"]}], "contacto_email": "o@p.com"}), 201)
    pid5 = next(p["id_pago"] for p in pedir("GET", f"/boliches/{U}/pagos?estado=a_revisar", None, TA1)[1] if p["id_operacion"] == "OP-500")
    chk("no se puede reactivar si el DNI ya lo tiene otra persona -> 409", pedir("PUT", f"/boliches/{U}/pagos/{pid5}/reactivar", None, TA1), 409)
    chk("el pago sigue a revisar para devolver el dinero", pedir("GET", f"/boliches/{U}/pagos?estado=a_revisar", None, TA1), 200, lambda d: any(p["id_pago"] == pid5 for p in d))
else:
    saltear("pagos tardíos y reactivación")

print("== Pagos manuales y de puerta ==")
c6 = comprar()
chk("el admin confirma a mano con efectivo", pedir("PUT", f"/boliches/{U}/compras/{c6['id_compra']}/pagar", {"metodo_pago": "efectivo"}, TA1), 200)
chk("método de pago inválido al confirmar -> 400", pedir("PUT", f"/boliches/{U}/compras/{comprar()['id_compra']}/pagar", {"metodo_pago": "cheque"}, TA1), 400)
vp = chk("venta en puerta del RRPP", pedir("POST", f"/boliches/{U}/eventos/{EV['id_evento']}/venta-puerta", {"items": [persona()], "metodo_pago": "qr"}, TR1), 201)
todos = pedir("GET", f"/boliches/{U}/pagos?estado=confirmado", None, TA1)[1]
verdad("el pago manual y el de puerta quedan registrados con su origen y quién lo cargó", any(p["id_compra"] == c6["id_compra"] and p["origen"] == "manual" and p["metodo"] == "efectivo" and p["registrado_por"] for p in todos) and any(p["id_compra"] == vp["id_compra"] and p["origen"] == "puerta" and p["metodo"] == "qr" for p in todos))

print("== Avisos al cliente ==")
time.sleep(1.5)  # el envío se hace aparte, unos segundos después
avisos = chk("el admin ve los avisos enviados", pedir("GET", f"/boliches/{U}/notificaciones", None, TA1), 200, lambda d: len(d) >= 2)
verdad("a quien dejó teléfono se le avisa por WhatsApp y a quien dejó email, por email", {a["canal"] for a in avisos if a["id_compra"] == c["id_compra"]} == {"whatsapp", "email"})
verdad("sin servicio de mensajes configurado quedan como simulados (no sale ningún mensaje)", all(a["estado"] == "simulada" for a in avisos if a["id_compra"] == c["id_compra"]))
solo_tel = pedir("POST", ruta(EV, "comprar"), {"items": [persona()], "contacto_telefono": "351 777 8888"})[1]
chk("pagar una compra con solo teléfono", avisar(solo_tel["referencia"], solo_tel["total"], "OP-700"), 200)
time.sleep(1.5)
verdad("con solo teléfono se avisa solo por WhatsApp", [a["canal"] for a in pedir("GET", f"/boliches/{U}/notificaciones", None, TA1)[1] if a["id_compra"] == solo_tel["id_compra"]] == ["whatsapp"])
chk("el RRPP no ve los avisos -> 403", pedir("GET", f"/boliches/{U}/notificaciones", None, TR1), 403)
chk("el admin de otro boliche -> 404", pedir("GET", f"/boliches/{U}/notificaciones", None, TA2), 404)

print("== Secreto no configurado ==")
saltear("el webhook sin secreto responde 503 (se prueba levantando el servidor sin PAGOS_WEBHOOK_SECRET)")
fin()
