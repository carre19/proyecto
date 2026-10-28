"""Pruebas de la fase 6: descuentos para clientes con cuenta, verificación en dos pasos de los admins, cobros y mensualidades del
superadmin (y lo que gana la plataforma) y borrado de datos personales a los 3 meses.
Corre contra una base recién cargada, con el backend en modo normal. Hace falta PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE para
envejecer fechas (las comprobaciones que dependen de eso se saltean si no están).
    API=http://localhost:3000/api python3 pruebas/api_fase6.py"""
import re, time
from comun import chk, entrar, fin, pedir, saltear, sql, totp, verdad

ahora = lambda: int(time.time() // 30)

TS, _ = entrar("superadmin@demo.com"); TA1, UA1 = entrar("admin1@demo.com"); TA2, UA2 = entrar("admin2@demo.com")
TM, _ = entrar("manager1@demo.com"); TR, _ = entrar("rrpp1@demo.com"); TC, UC = entrar("cliente@demo.com")
U = next(b["id_boliche"] for b in UA1["boliches"] if b["nombre"] == "Boliche Uno"); D = next(b["id_boliche"] for b in UA1["boliches"] if b["nombre"] == "Bar Dos"); T3 = UA2["boliches"][0]["id_boliche"]
pub = pedir("GET", "/publico/boliches/boliche-uno")[1]
EV = next(e for e in pub["eventos"] if e["nombre"] == "Noche Electrónica")
TANDA2 = next(t for t in EV["entradas"] if t["nombre"] == "Tanda 2")["id_tipo_entrada"]
_dni = [92000000]
def persona(tipo=TANDA2, nombre="Ana"):
    _dni[0] += 1
    return {"id_tipo_entrada": tipo, "nombre": nombre, "apellido": "Pérez", "dni": str(_dni[0])}
comprar = lambda cuerpo, tk=None, ev=EV, sub="boliche-uno": pedir("POST", f"/publico/boliches/{sub}/eventos/{ev['id_evento']}/comprar", cuerpo, tk)
cargos_pagados = []  # el 6 % de cada compra de la página que se paga en esta prueba (para el resumen de la plataforma)

# ---------------------------------------------------------------------------------------------------------
print("== Descuentos del admin ==")
D_ = lambda m="GET", ruta="descuentos", cuerpo=None, tk=TA1, b=U: pedir(m, f"/boliches/{b}/{ruta}", cuerpo, tk)
chk("al principio no hay descuentos", D_(), 200, lambda d: d == [])
for nombre, pedir_ in [("el manager", TM), ("el RRPP", TR), ("el cliente", TC)]:
    chk(f"{nombre} no los ve -> 403", D_(tk=pedir_), 403)
chk("el admin de otro boliche -> 404", D_(tk=TA2), 404)
d10 = chk("el admin crea un descuento de bienvenida del 10 % para cuentas de cualquier antigüedad", D_("POST", cuerpo={"nombre": "Bienvenida", "porcentaje": 10, "antiguedad_meses": 0}), 201, lambda d: d["porcentaje"] == 10 and d["activo"])
d15 = chk("y uno del 15 % para cuentas de más de 6 meses (el ejemplo de la documentación: pagando por transferencia)", D_("POST", cuerpo={"nombre": "Cliente de más de 6 meses", "porcentaje": 15, "antiguedad_meses": 6}), 201)
for nombre, cuerpo in [("porcentaje cero", {"nombre": "X", "porcentaje": 0}), ("más de 100 %", {"nombre": "X", "porcentaje": 101}), ("porcentaje que no es número", {"nombre": "X", "porcentaje": "mucho"}),
                       ("sin porcentaje", {"nombre": "X"}), ("sin nombre", {"porcentaje": 5}), ("antigüedad negativa", {"nombre": "X", "porcentaje": 5, "antiguedad_meses": -1}),
                       ("antigüedad con decimales", {"nombre": "X", "porcentaje": 5, "antiguedad_meses": 1.5})]:
    chk(f"{nombre} -> 400", D_("POST", cuerpo=cuerpo), 400)
chk("editar el porcentaje", D_("PUT", f"descuentos/{d10['id_descuento']}", {"porcentaje": 12.5}), 200, lambda d: d["porcentaje"] == 12.5)
chk("editar sin nada -> 400", D_("PUT", f"descuentos/{d10['id_descuento']}", {}), 400)
chk("el admin de otro boliche no lo toca -> 404", D_("PUT", f"descuentos/{d10['id_descuento']}", {"porcentaje": 1}, TA2, T3), 404)
chk("la lista queda ordenada por porcentaje", D_(), 200, lambda d: [x["porcentaje"] for x in d] == [15, 12.5])
extra = D_("POST", cuerpo={"nombre": "Para borrar", "porcentaje": 3})[1]
chk("borrar un descuento", D_("DELETE", f"descuentos/{extra['id_descuento']}"), 200)
chk("borrarlo de nuevo -> 404", D_("DELETE", f"descuentos/{extra['id_descuento']}"), 404)

print("== Descuento en la compra ==")
chk("sin cuenta no hay descuento: 2 entradas de 10.000 + 6 % = 21.200", comprar({"items": [persona(), persona()], "contacto_email": "a@b.com"}), 201, lambda d: d["descuento"] == 0 and d["total"] == 21200 and d["descuento_nombre"] is None)
chk("el descuento que le toca al cliente nuevo (12,5 % de bienvenida)", pedir("GET", "/publico/boliches/boliche-uno/descuento", None, TC), 200, lambda d: d["descuento"] == {"nombre": "Bienvenida", "porcentaje": 12.5})
chk("el personal del boliche no recibe descuentos", pedir("GET", "/publico/boliches/boliche-uno/descuento", None, TA1), 200, lambda d: d["descuento"] is None)
chk("sin sesión tampoco", pedir("GET", "/publico/boliches/boliche-uno/descuento"), 200, lambda d: d["descuento"] is None)
chk("un boliche que no existe -> 404", pedir("GET", "/publico/boliches/no-existe/descuento", None, TC), 404)
cd = chk("el cliente nuevo compra 2 entradas: 12,5 % de 20.000 = 2.500; el 6 % se calcula sobre lo que paga (17.500 -> 1.050)", comprar({"items": [persona(), persona()], "contacto_email": "c@d.com"}, TC), 201,
         lambda d: d["subtotal"] == 20000 and d["descuento"] == 2500 and d["cargo_plataforma"] == 1050 and d["total"] == 18550 and d["descuento_nombre"] == "Bienvenida")
pedir("PUT", f"/boliches/{U}/compras/{cd['id_compra']}/pagar", None, TA1); cargos_pagados.append(cd["cargo_plataforma"])
chk("la compra con descuento se ve con su descuento y su nombre", pedir("GET", f"/publico/compras/{cd['token_publico']}"), 200, lambda d: d["descuento"] == 2500 and d["descuento_nombre"] == "Bienvenida")
chk("el descuento redondea para abajo (12,5 % de 10.000 = 1.250)", comprar({"items": [persona()], "contacto_email": "c@d.com"}, TC), 201, lambda d: d["descuento"] == 1250)
chk("un descuento desactivado no se aplica", D_("PUT", f"descuentos/{d10['id_descuento']}", {"activo": False}), 200)
chk("... y entonces no corresponde ninguno", pedir("GET", "/publico/boliches/boliche-uno/descuento", None, TC), 200, lambda d: d["descuento"] is None)
chk("... y la compra sale sin descuento", comprar({"items": [persona()], "contacto_email": "c@d.com"}, TC), 201, lambda d: d["descuento"] == 0)
if sql("SELECT 1"):
    sql("UPDATE usuario SET fecha_creacion = now() - interval '7 months' WHERE email = 'cliente@demo.com'")
    D_("PUT", f"descuentos/{d10['id_descuento']}", {"activo": True})
    chk("con una cuenta de 7 meses le toca el mayor (15 %), no se suman", pedir("GET", "/publico/boliches/boliche-uno/descuento", None, TC), 200, lambda d: d["descuento"] == {"nombre": "Cliente de más de 6 meses", "porcentaje": 15})
    chk("y la compra usa el 15 %", comprar({"items": [persona()], "contacto_email": "c@d.com"}, TC), 201, lambda d: d["descuento"] == 1500 and d["descuento_nombre"] == "Cliente de más de 6 meses")
else:
    saltear("descuento por antigüedad de la cuenta")
chk("el descuento no se aplica a ventas en la puerta", pedir("POST", f"/boliches/{U}/eventos/{EV['id_evento']}/venta-puerta", {"items": [persona()], "metodo_pago": "efectivo"}, TA1), 201, lambda d: d["descuento"] == 0 and d["total"] == 12000)

# ---------------------------------------------------------------------------------------------------------
print("== Verificación en dos pasos ==")
chk("quien no es admin no tiene verificación -> 403", pedir("GET", "/auth/2fa", None, TM), 403)
chk("el cliente tampoco -> 403", pedir("GET", "/auth/2fa", None, TC), 403)
chk("el admin ve que no la tiene activa y que es opcional", pedir("GET", "/auth/2fa", None, TA2), 200, lambda d: d["activa"] is False and d["obligatoria"] is False)
chk("el perfil indica que le corresponde", pedir("GET", "/auth/perfil", None, TA2), 200, lambda d: d["verificacion"] == {"aplica": True, "activa": False, "obligatoria": False})
chk("el cliente no tiene verificación en su perfil", pedir("GET", "/auth/perfil", None, TC), 200, lambda d: d["verificacion"]["aplica"] is False)
chk("sin haber pedido el QR, activar -> 409", pedir("POST", "/auth/2fa/activar", {"codigo": "123456"}, TA2), 409)
prep = chk("el admin pide el secreto para su app", pedir("POST", "/auth/2fa/preparar", None, TA2), 200, lambda d: re.fullmatch(r"[A-Z2-7]{32}", d["secreto"]) and d["otpauth_url"].startswith("otpauth://totp/Noctis:admin2%40demo.com?secret="))
chk("un código incorrecto no la activa -> 400", pedir("POST", "/auth/2fa/activar", {"codigo": "000000" if totp(prep["secreto"]) != "000000" else "111111"}, TA2), 400)
chk("un código con formato inválido -> 400", pedir("POST", "/auth/2fa/activar", {"codigo": "abc"}, TA2), 400)
act = chk("con el código de la app se activa y se reciben 8 códigos de recuperación", pedir("POST", "/auth/2fa/activar", {"codigo": totp(prep["secreto"])}, TA2), 200, lambda d: len(d["codigos_de_recuperacion"]) == 8 and d["token"] and d["usuario"]["verificacion"]["activa"])
recup = act["codigos_de_recuperacion"]
verdad("los códigos de recuperación tienen formato XXXXX-XXXXX y son distintos", all(re.fullmatch(r"[0-9A-F]{5}-[0-9A-F]{5}", c) for c in recup) and len(set(recup)) == 8)
chk("ya activa: volver a prepararla -> 409", pedir("POST", "/auth/2fa/preparar", None, TA2), 409)
chk("ya activa: el estado lo dice", pedir("GET", "/auth/2fa", None, TA2), 200, lambda d: d["activa"] and d["codigos_de_recuperacion_restantes"] == 8)

lg = chk("al iniciar sesión ahora pide el segundo paso y NO entrega sesión", pedir("POST", "/auth/login", {"email": "admin2@demo.com", "password": "demo12345"}), 200, lambda d: d["requiere_verificacion"] and d["ticket"] and "token" not in d)
ticket = lg["ticket"]
chk("el ticket no sirve como sesión -> 401", pedir("GET", "/boliches", None, ticket), 401)
chk("contraseña mala: ni siquiera da el ticket", pedir("POST", "/auth/login", {"email": "admin2@demo.com", "password": "x"}), 401)
chk("código incorrecto -> 401", pedir("POST", "/auth/2fa/verificar", {"ticket": ticket, "codigo": "000001"}), 401)
chk("sin ticket -> 401", pedir("POST", "/auth/2fa/verificar", {"codigo": totp(prep["secreto"], ahora() + 1)}), 401)
chk("un ticket inventado -> 401", pedir("POST", "/auth/2fa/verificar", {"ticket": "abc.def.ghi", "codigo": totp(prep["secreto"], ahora() + 1)}), 401)
# el código del paso actual ya se usó para activar; el del paso siguiente todavía vale
siguiente = totp(prep["secreto"], ahora() + 1)
chk("el código del paso siguiente (los relojes pueden diferir unos segundos) completa el login", pedir("POST", "/auth/2fa/verificar", {"ticket": ticket, "codigo": siguiente}), 200, lambda d: d["token"] and d["usuario"]["rol"] == "admin")
chk("el mismo código no se puede usar dos veces", pedir("POST", "/auth/2fa/verificar", {"ticket": ticket, "codigo": siguiente}), 401)
chk("el código con el que se activó tampoco se puede repetir", pedir("POST", "/auth/2fa/verificar", {"ticket": ticket, "codigo": totp(prep["secreto"])}), 401)
rec = recup[0]
t2 = pedir("POST", "/auth/login", {"email": "admin2@demo.com", "password": "demo12345"})[1]["ticket"]
chk("un código de recuperación (en minúsculas y sin guion) también entra", pedir("POST", "/auth/2fa/verificar", {"ticket": t2, "codigo": rec.lower().replace("-", "")}), 200, lambda d: d["token"])
chk("pero solo una vez", pedir("POST", "/auth/2fa/verificar", {"ticket": t2, "codigo": rec}), 401)
chk("quedan 7 códigos de recuperación", pedir("GET", "/auth/2fa", None, TA2), 200, lambda d: d["codigos_de_recuperacion_restantes"] == 7)
chk("el superadmin tiene su propia verificación (todavía sin activar): entra directo", pedir("POST", "/auth/login", {"email": "superadmin@demo.com", "password": "demo12345"}), 200, lambda d: "token" in d)
chk("el cliente nunca pide segundo paso", pedir("POST", "/auth/login", {"email": "cliente@demo.com", "password": "demo12345"}), 200, lambda d: "token" in d)

print("== Verificación: desactivarla, restablecerla y los intentos fallidos ==")
def admin_nuevo(n):
    s, d = pedir("POST", "/usuarios", {"nombre": "Admin", "apellido": f"Seis{n}", "email": f"admin6{n}@demo.com", "password": "clave12345"}, TS)
    assert s == 201, d
    tk, _ = entrar(f"admin6{n}@demo.com", "clave12345")
    sec = pedir("POST", "/auth/2fa/preparar", None, tk)[1]["secreto"]
    s2, r2 = pedir("POST", "/auth/2fa/activar", {"codigo": totp(sec)}, tk)
    assert s2 == 200, (s2, r2)
    codigos = r2["codigos_de_recuperacion"]
    return d["id_usuario"] if "id_usuario" in d else d.get("id"), tk, sec, codigos
a1, tk1, sec1, _ = admin_nuevo(1)
chk("desactivar con contraseña mala -> 401", pedir("POST", "/auth/2fa/desactivar", {"password": "mala", "codigo": totp(sec1, ahora() + 1)}, tk1), 401)
chk("desactivar con código malo -> 401", pedir("POST", "/auth/2fa/desactivar", {"password": "clave12345", "codigo": "000002"}, tk1), 401)
chk("con la contraseña y un código vigente se desactiva (cuando es opcional)", pedir("POST", "/auth/2fa/desactivar", {"password": "clave12345", "codigo": totp(sec1, ahora() + 1)}, tk1), 200)
chk("después entra directo, sin segundo paso", pedir("POST", "/auth/login", {"email": "admin61@demo.com", "password": "clave12345"}), 200, lambda d: "token" in d)
chk("desactivar sin tenerla -> 409", pedir("POST", "/auth/2fa/desactivar", {"password": "clave12345", "codigo": "123456"}, tk1), 409)

a2, tk2, sec2, _ = admin_nuevo(2)
chk("el admin pierde el celular: el superadmin se la restablece", pedir("DELETE", f"/usuarios/{a2}/2fa", None, TS), 200)
chk("después entra directo", pedir("POST", "/auth/login", {"email": "admin62@demo.com", "password": "clave12345"}), 200, lambda d: "token" in d)
chk("restablecer a alguien que no es admin -> 404", pedir("DELETE", f"/usuarios/{UC['id']}/2fa", None, TS), 404)
chk("un admin no puede restablecerle la verificación a otro -> 403", pedir("DELETE", f"/usuarios/{a2}/2fa", None, TA1), 403)
chk("id inválido -> 400", pedir("DELETE", "/usuarios/abc/2fa", None, TS), 400)

a3, tk3, sec3, cod3 = admin_nuevo(3)
tk = pedir("POST", "/auth/login", {"email": "admin63@demo.com", "password": "clave12345"})[1]["ticket"]
for i in range(5):
    chk(f"código incorrecto #{i + 1}", pedir("POST", "/auth/2fa/verificar", {"ticket": tk, "codigo": f"00000{i}"}), 401)
chk("después de 5 fallos se frena aunque el código sea bueno -> 429", pedir("POST", "/auth/2fa/verificar", {"ticket": tk, "codigo": cod3[0]}), 429)

# ---------------------------------------------------------------------------------------------------------
print("== Cobros y mensualidades del superadmin ==")
P = lambda m="GET", ruta="", cuerpo=None, tk=TS: pedir(m, f"/plataforma/{ruta}", cuerpo, tk)
for nombre, t in [("el admin", TA1), ("el manager", TM), ("el RRPP", TR), ("el cliente", TC)]:
    chk(f"{nombre} no entra a lo de la plataforma -> 403", P("GET", "resumen", None, t), 403)
chk("sin sesión -> 401", P("GET", "resumen", None, None), 401)
chk("el superadmin define Boliche Uno: mensualidad de 50.000", pedir("PUT", f"/boliches/{U}", {"tipo_cobro": "mensual", "monto_mensual": 50000}, TS), 200)
chk("Bar Dos: mensualidad de 30.000", pedir("PUT", f"/boliches/{D}", {"tipo_cobro": "mensual", "monto_mensual": 30000}, TS), 200)
chk("Club Tres es de un solo evento: 25.000 por evento y sin mensualidad", pedir("PUT", f"/boliches/{T3}", {"tipo_cobro": "evento_unico", "monto_mensual": 25000}, TS), 200)
ev3 = chk("el admin de Club Tres arma su evento de marzo", pedir("POST", f"/boliches/{T3}/eventos", {"nombre": "Fiesta única", "fecha_hora": "2027-03-12T23:00:00-03:00"}, TA2), 201)
chk("período inválido -> 400", P("POST", "cobros/generar", {"periodo": "marzo"}), 400)
chk("mes 13 -> 400", P("POST", "cobros/generar", {"periodo": "2027-13"}), 400)
chk("sin período -> 400", P("POST", "cobros/generar", {}), 400)
g = chk("se generan los cobros de marzo: 2 mensualidades y 1 evento único", P("POST", "cobros/generar", {"periodo": "2027-03"}), 200, lambda d: d["mensualidades_creadas"] == 2 and d["eventos_creados"] == 1)
chk("repetirlo no duplica nada", P("POST", "cobros/generar", {"periodo": "2027-03"}), 200, lambda d: d["mensualidades_creadas"] == 0 and d["eventos_creados"] == 0)
chk("otro mes: 2 mensualidades más (el evento único es de marzo)", P("POST", "cobros/generar", {"periodo": "2027-04"}), 200, lambda d: d["mensualidades_creadas"] == 2 and d["eventos_creados"] == 0)
cobros = chk("la lista de cobros", P("GET", "cobros"), 200, lambda d: len(d) == 5 and all(c["estado"] == "pendiente" for c in d))
verdad("las mensualidades traen el período y el boliche, y el evento único trae el evento", {(c["boliche"], c["tipo"], c["periodo"]) for c in cobros if c["tipo"] == "mensualidad"} == {("Boliche Uno", "mensualidad", "2027-03"), ("Bar Dos", "mensualidad", "2027-03"), ("Boliche Uno", "mensualidad", "2027-04"), ("Bar Dos", "mensualidad", "2027-04")} and any(c["tipo"] == "evento_unico" and c["evento"] == "Fiesta única" and c["monto"] == 25000 for c in cobros))
verdad("Club Tres no tiene mensualidad", all(c["boliche"] != "Club Tres" or c["tipo"] == "evento_unico" for c in cobros))
chk("filtrar por boliche", P("GET", f"cobros?id_boliche={U}"), 200, lambda d: len(d) == 2 and all(c["monto"] == 50000 for c in d))
chk("boliche inválido -> 400", P("GET", "cobros?id_boliche=x"), 400)
c0 = cobros[0]["id_cobro"]
chk("el superadmin marca un cobro como pagado", P("PUT", f"cobros/{c0}/pagar", {"nota": "Transferencia del 5/3"}), 200)
chk("pagarlo de nuevo -> 409", P("PUT", f"cobros/{c0}/pagar", {}), 409)
chk("un cobro que no existe -> 404", P("PUT", "cobros/999999/pagar", {}), 404)
chk("id inválido -> 400", P("PUT", "cobros/abc/pagar", {}), 400)
chk("filtrar los pagados", P("GET", "cobros?estado=pagado"), 200, lambda d: len(d) == 1 and d[0]["nota"] == "Transferencia del 5/3" and d[0]["pagado_en"])
chk("un admin no marca cobros -> 403", P("PUT", f"cobros/{cobros[1]['id_cobro']}/pagar", {}, TA1), 403)

print("== Lo que gana la plataforma ==")
r0 = chk("el resumen del superadmin", P("GET", "resumen"), 200, lambda d: d["boliches"] == {"total": 3, "activos": 3} and d["cobros"]["pendientes"] == 4 and d["entradas"]["porcentaje"] == 6)
verdad("los cobros pendientes suman lo que corresponde y lo cobrado lo que se pagó", r0["cobros"]["monto_cobrado"] == next(c["monto"] for c in cobros if c["id_cobro"] == c0) and r0["cobros"]["monto_pendiente"] == sum(c["monto"] for c in cobros) - r0["cobros"]["monto_cobrado"])
w1 = comprar({"items": [persona()], "contacto_email": "x@y.com"})[1]
chk("una compra sin pagar no suma", P("GET", "resumen"), 200, lambda d: d["entradas"]["ganado_total"] == sum(cargos_pagados))
pedir("PUT", f"/boliches/{U}/compras/{w1['id_compra']}/pagar", None, TA1); cargos_pagados.append(w1["cargo_plataforma"])
chk("ya paga: se suma el 6 % de esa compra (600) al total y al mes", P("GET", "resumen"), 200, lambda d: d["entradas"]["ganado_total"] == sum(cargos_pagados) and d["entradas"]["ganado_mes"] == sum(cargos_pagados) and d["entradas"]["compras_pagadas"] == len(cargos_pagados))
chk("la ganancia por boliche", P("GET", "resumen"), 200, lambda d: next(b for b in d["por_boliche"] if b["nombre"] == "Boliche Uno")["cargo"] == sum(cargos_pagados) and next(b for b in d["por_boliche"] if b["nombre"] == "Boliche Uno")["pendiente"] == 100000)
pv = pedir("POST", f"/boliches/{U}/eventos/{EV['id_evento']}/venta-puerta", {"items": [persona()], "metodo_pago": "efectivo"}, TA1)
chk("las ventas en la puerta NO pagan el 6 %", P("GET", "resumen"), 200, lambda d: d["entradas"]["ganado_total"] == sum(cargos_pagados))

# ---------------------------------------------------------------------------------------------------------
print("== Borrado de datos personales a los 3 meses ==")
if not sql("SELECT 1"):
    saltear("borrado de datos (necesita envejecer fechas en la base)")
else:
    adm = lambda m, ruta, cuerpo=None, tk=TA1: pedir(m, f"/boliches/{U}/{ruta}", cuerpo, tk)
    def evento_con_entrada(nombre):
        e = adm("POST", "eventos", {"nombre": nombre, "fecha_hora": "2027-09-01T23:00:00-03:00", "edad_minima": 18}, TA1)[1]
        t = adm("POST", f"eventos/{e['id_evento']}/entradas", {"nombre": "General", "precio_virtual": 5000, "precio_puerta": 6000, "cupo": 20}, TA1)[1]
        return e, t
    e_viejo, t_viejo = evento_con_entrada("Evento viejo"); e_futuro, t_futuro = evento_con_entrada("Evento futuro")
    mk = lambda e, t, dni, nombre, tel="351 111 2222": comprar({"items": [{"id_tipo_entrada": t["id_tipo_entrada"], "nombre": nombre, "apellido": "Dato", "dni": str(dni)}], "contacto_email": f"{nombre.lower()}@mail.com", "contacto_telefono": tel}, None, e)[1]
    pagar = lambda c: adm("PUT", f"compras/{c['id_compra']}/pagar", None)

    c_viejo = mk(e_viejo, t_viejo, 93000001, "Vieja"); pagar(c_viejo)
    c_reciente = mk(e_viejo, t_viejo, 93000002, "Mixta"); pagar(c_reciente)      # su DNI también compró algo reciente: no se borra
    c_mixta2 = mk(e_futuro, t_futuro, 93000002, "Mixta"); pagar(c_mixta2)
    c_adelantada = mk(e_futuro, t_futuro, 93000003, "Adelantada"); pagar(c_adelantada)   # compró hace meses pero el evento es futuro
    c_puerta = adm("POST", f"eventos/{e_viejo['id_evento']}/venta-puerta", {"items": [{"id_tipo_entrada": t_viejo["id_tipo_entrada"], "nombre": "Puerta", "apellido": "Vieja", "dni": "93000004"}], "metodo_pago": "efectivo"}, TR)[1]
    time.sleep(1.2)  # que salgan los avisos del pago antes de envejecerlo todo
    sql(f"UPDATE evento SET fecha_hora = now() - interval '5 months' WHERE id_evento = {e_viejo['id_evento']}")
    sql(f"UPDATE compra SET creada_en = now() - interval '5 months' WHERE id_compra IN ({c_viejo['id_compra']}, {c_adelantada['id_compra']}, {c_puerta['id_compra']})")
    sql(f"UPDATE compra SET creada_en = now() - interval '5 months' WHERE id_compra = {c_reciente['id_compra']}")   # la compra del evento viejo es vieja; la otra (del futuro) es reciente
    sql(f"UPDATE compra SET creada_en = now() - interval '5 months' WHERE id_compra = {c_mixta2['id_compra']}")
    sql(f"UPDATE compra SET creada_en = now() - interval '1 day' WHERE id_compra = {c_mixta2['id_compra']}")
    antes = adm("GET", f"eventos/{e_viejo['id_evento']}/ventas")[1]
    recaud_antes = antes["resumen"]["recaudado"]
    l_viejo = pedir("POST", f"/boliches/{U}/eventos/{e_viejo['id_evento']}/listas", {"nombre": "Lista vieja"}, TR)[1]
    inv_viejo = pedir("POST", f"/boliches/{U}/eventos/{e_viejo['id_evento']}/listas/{l_viejo['id_lista']}/invitados", {"nombre": "Invi", "apellido": "Viejo", "dni": "94000001", "telefono": "351 333 4444", "edad": 25}, TR)[1]
    l_fut = pedir("POST", f"/boliches/{U}/eventos/{e_futuro['id_evento']}/listas", {"nombre": "Lista futura"}, TR)[1]
    pedir("POST", f"/boliches/{U}/eventos/{e_futuro['id_evento']}/listas/{l_fut['id_lista']}/invitados", {"nombre": "Invi", "apellido": "Futuro", "dni": "94000002", "edad": 25}, TR)
    sql(f"UPDATE lista_invitados SET creada_en = now() - interval '5 months' WHERE id_lista = {l_viejo['id_lista']}")
    # cuentas: una inactiva sin compras, una inactiva con una compra de un evento futuro, una activa
    for n in ("a", "b", "c"):
        pedir("POST", "/auth/register", {"nombre": "Cta", "apellido": n.upper(), "email": f"cuenta.{n}@mail.com", "password": "clave12345"})
    tb, _ = entrar("cuenta.b@mail.com", "clave12345")
    comprar({"items": [{"id_tipo_entrada": t_futuro["id_tipo_entrada"], "nombre": "B", "apellido": "Cuenta", "dni": "93000009"}], "contacto_email": "b@mail.com"}, tb, e_futuro)
    sql("UPDATE usuario SET ultima_actividad = now() - interval '5 months' WHERE email IN ('cuenta.a@mail.com', 'cuenta.b@mail.com')")

    for nombre, t in [("el admin", TA1), ("el manager", TM), ("el cliente", TC)]:
        chk(f"{nombre} no puede ejecutar el borrado -> 403", P("POST", "retencion/ejecutar", None, t), 403)
    r = chk("el superadmin ejecuta el borrado", P("POST", "retencion/ejecutar"), 200, lambda d: d["entradas"] == 2 and d["compras"] == 2 and d["invitados"] == 1 and d["cuentas"] == 1)
    ve = adm("GET", f"eventos/{e_viejo['id_evento']}/ventas")[1]
    ent = {e["nombre"] for c in ve["compras"] for e in c["entradas"]}
    verdad("las entradas de quien no volvió en 3 meses quedan sin nombre ni DNI", "Vieja" not in ent and "Puerta" not in ent and "(borrado)" in ent)
    verdad("el DNI queda reemplazado por un número que no es de nadie", all(re.fullmatch(r"00\d{7}", e["dni"]) for c in ve["compras"] for e in c["entradas"] if e["nombre"] == "(borrado)"))
    verdad("pero se conserva lo económico: lo vendido sigue igual", ve["resumen"]["recaudado"] == recaud_antes)
    verdad("la persona que también tiene una compra reciente NO se borra (se cuenta desde su última compra)", any(e["nombre"] == "Mixta" for c in ve["compras"] for e in c["entradas"]))
    vf = adm("GET", f"eventos/{e_futuro['id_evento']}/ventas")[1]
    verdad("lo comprado hace meses para un evento que todavía no pasó NO se borra", any(e["nombre"] == "Adelantada" and e["dni"] == "93000003" for c in vf["compras"] for e in c["entradas"]))
    verdad("el contacto de las compras vencidas se borra", sql(f"SELECT contacto_email IS NULL AND contacto_telefono IS NULL FROM compra WHERE id_compra = {c_viejo['id_compra']}") == "t")
    verdad("el contacto de una compra reciente se conserva", sql(f"SELECT contacto_email IS NOT NULL FROM compra WHERE id_compra = {c_mixta2['id_compra']}") == "t")
    verdad("los avisos enviados también pierden el destino", sql(f"SELECT bool_and(destino = '(borrado)') FROM notificacion WHERE id_compra = {c_viejo['id_compra']}") == "t")
    lis = pedir("GET", f"/boliches/{U}/eventos/{e_viejo['id_evento']}/listas", None, TR)[1]
    verdad("los invitados de un evento de hace más de 3 meses se borran", lis[0]["invitados"][0]["nombre"] == "(borrado)" and lis[0]["invitados"][0]["telefono"] is None)
    verdad("los de un evento futuro quedan", pedir("GET", f"/boliches/{U}/eventos/{e_futuro['id_evento']}/listas", None, TR)[1][0]["invitados"][0]["nombre"] == "Invi")
    verdad("se borró la cuenta inactiva sin compras", sql("SELECT count(*) FROM usuario WHERE email = 'cuenta.a@mail.com'") == "0")
    verdad("la cuenta inactiva con una compra de un evento futuro se conserva", sql("SELECT count(*) FROM usuario WHERE email = 'cuenta.b@mail.com'") == "1")
    verdad("la cuenta activa se conserva", sql("SELECT count(*) FROM usuario WHERE email = 'cuenta.c@mail.com'") == "1")
    verdad("las compras de la cuenta borrada, si las hubiera, no se pierden (solo se desvincula la cuenta)", sql("SELECT count(*) FROM compra WHERE id_cliente IS NULL") != "")
    chk("correrlo de nuevo no cambia nada", P("POST", "retencion/ejecutar"), 200, lambda d: d == {"entradas": 0, "compras": 0, "avisos": 0, "invitados": 0, "cuentas": 0})
    chk("una persona borrada ya no se encuentra por su DNI en la puerta", pedir("POST", f"/boliches/{U}/eventos/{e_viejo['id_evento']}/puerta/buscar", {"dni": "93000001"}, TA1), 200, lambda d: d == [])
    chk("el DNI liberado se puede volver a usar para comprar", comprar({"items": [{"id_tipo_entrada": t_futuro["id_tipo_entrada"], "nombre": "Vuelve", "apellido": "Otra", "dni": "93000001"}], "contacto_email": "v@mail.com"}, None, e_futuro), 201)

fin()
