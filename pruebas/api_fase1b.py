"""Pruebas de la fase 1B: ficha del boliche, entradas de cada evento, carta de bebidas, mesas VIP, colores
y la página pública. Cubre sobre todo el aislamiento entre boliches, los permisos de cada rol y las reglas
que garantiza la base (cupos contra capacidad, nombres únicos, contraste de colores).

Se corre igual que las otras: contra una base RECIÉN cargada y con el backend levantado.
    ./database/cargar_base.sh --reset
    npm run dev                                   # en otra terminal
    API=http://localhost:3000/api python3 pruebas/api_fase1b.py

Cada línea dice OK o FALLA; al final resume. Sale con código distinto de 0 si algo falla.
"""
import json, os, struct, sys, urllib.request, urllib.error, zlib
B = os.environ.get("API", "http://localhost:3000/api")
ORIGEN = B.rsplit("/api", 1)[0]


def png(color=(200, 30, 60)):
    def trozo(tipo, datos):
        c = struct.pack(">I", len(datos)) + tipo + datos
        return c + struct.pack(">I", zlib.crc32(tipo + datos) & 0xFFFFFFFF)
    filas = b"".join(b"\x00" + bytes(color) * 4 for _ in range(4))
    return b"\x89PNG\r\n\x1a\n" + trozo(b"IHDR", struct.pack(">IIBBBBB", 4, 4, 8, 2, 0, 0, 0)) + trozo(b"IDAT", zlib.compress(filas)) + trozo(b"IEND", b"")


def pedir(metodo, ruta, cuerpo=None, token=None, tipo="application/json"):
    datos = cuerpo if isinstance(cuerpo, (bytes, bytearray)) else (json.dumps(cuerpo).encode() if cuerpo is not None else None)
    cab = {"Content-Type": tipo, **({"Authorization": "Bearer " + token} if token else {})}
    req = urllib.request.Request(B + ruta, method=metodo, data=datos, headers=cab)
    try:
        r = urllib.request.urlopen(req)
        return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        try: d = json.loads(e.read())
        except Exception: d = {}
        return e.code, d


fallas = []
def chk(nombre, resp, esperado, cond=None):
    ok = resp[0] == esperado and (cond is None or cond(resp[1]))
    print(("OK   " if ok else "FALLA"), f"[{resp[0]}]", nombre, "" if ok else "-> " + json.dumps(resp[1], ensure_ascii=False)[:220])
    if not ok: fallas.append(nombre)
    return resp[1]

def verdad(nombre, condicion):
    print(("OK   " if condicion else "FALLA"), nombre)
    if not condicion: fallas.append(nombre)


def entrar(email):
    s, d = pedir("POST", "/auth/login", {"email": email, "password": "demo12345"})
    assert s == 200, (email, d)
    return d["token"], d["usuario"]


TS, _ = entrar("superadmin@demo.com"); TA1, UA1 = entrar("admin1@demo.com"); TA2, _ = entrar("admin2@demo.com")
TM, _ = entrar("manager1@demo.com"); TR, _ = entrar("rrpp1@demo.com"); TC, _ = entrar("cliente@demo.com")
ids = {b["nombre"]: b["id_boliche"] for b in UA1["boliches"]}; U = ids["Boliche Uno"]; D = ids["Bar Dos"]
eventos = pedir("GET", f"/boliches/{U}/eventos", None, TA1)[1]
EV = next(e for e in eventos if e["nombre"] == "Noche Electrónica")["id_evento"]
EV_RETRO = next(e for e in eventos if e["nombre"] == "Fiesta Retro")["id_evento"]
EV_DOS = pedir("GET", f"/boliches/{D}/eventos", None, TA1)[1][0]["id_evento"]   # un evento de OTRO boliche

# ---------------------------------------------------------------------------------------------------------
print("== Ficha del boliche: descripción, ubicación y capacidad ==")
chk("el admin completa la ficha", pedir("PUT", f"/boliches/{U}", {"descripcion": "El mejor lugar", "direccion": "Av. Siempreviva 123", "latitud": -31.4201, "longitud": -64.1888, "capacidad": 900}, TA1), 200,
    lambda d: d["capacidad"] == 900 and d["direccion"] == "Av. Siempreviva 123" and float(d["latitud"]) == -31.4201)
chk("la ficha sale en la página pública", pedir("GET", "/publico/boliches/boliche-uno"), 200,
    lambda d: d["capacidad"] == 900 and d["latitud"] == -31.4201 and d["longitud"] == -64.1888 and d["descripcion"] == "El mejor lugar")
chk("latitud fuera de rango", pedir("PUT", f"/boliches/{U}", {"latitud": 120}, TA1), 400)
chk("longitud fuera de rango", pedir("PUT", f"/boliches/{U}", {"longitud": -200}, TA1), 400)
chk("capacidad cero", pedir("PUT", f"/boliches/{U}", {"capacidad": 0}, TA1), 400)
chk("capacidad que no es número", pedir("PUT", f"/boliches/{U}", {"capacidad": "mucha"}, TA1), 400)
chk("capacidad con decimales", pedir("PUT", f"/boliches/{U}", {"capacidad": 100.5}, TA1), 400)
chk("no se baja la capacidad por debajo de los cupos ya repartidos (700)", pedir("PUT", f"/boliches/{U}", {"capacidad": 500}, TA1), 400, lambda d: "cupos" in d["mensaje"])
chk("el manager NO edita la ficha", pedir("PUT", f"/boliches/{U}", {"capacidad": 5000}, TM), 403)
chk("el admin de otro boliche -> 404", pedir("PUT", f"/boliches/{U}", {"capacidad": 5000}, TA2), 404)
chk("el RRPP ve la ficha completa (con sus fotos)", pedir("GET", f"/boliches/{U}", None, TR), 200, lambda d: d["capacidad"] == 900 and isinstance(d["fotos"], list))

# ---------------------------------------------------------------------------------------------------------
print("== Entradas de un evento (tandas y VIP) ==")
chk("el admin ve las entradas del evento", pedir("GET", f"/boliches/{U}/eventos/{EV}/entradas", None, TA1), 200, lambda d: len(d) == 4)
chk("el RRPP también las ve", pedir("GET", f"/boliches/{U}/eventos/{EV}/entradas", None, TR), 200)
chk("el manager también las ve", pedir("GET", f"/boliches/{U}/eventos/{EV}/entradas", None, TM), 200)
chk("el cliente NO las ve por la API del panel", pedir("GET", f"/boliches/{U}/eventos/{EV}/entradas", None, TC), 403)
chk("el admin de otro boliche no las ve -> 404", pedir("GET", f"/boliches/{U}/eventos/{EV}/entradas", None, TA2), 404)
chk("un evento de otro boliche no se alcanza desde este -> 404", pedir("GET", f"/boliches/{U}/eventos/{EV_DOS}/entradas", None, TA1), 404)
chk("no se crean entradas en un evento de otro boliche -> 404", pedir("POST", f"/boliches/{U}/eventos/{EV_DOS}/entradas", {"nombre": "Colada", "precio_virtual": 1, "precio_puerta": 1, "cupo": 1}, TA1), 404)

e = chk("el admin crea una tanda (cupo justo: 700 + 200 = 900 = capacidad)", pedir("POST", f"/boliches/{U}/eventos/{EV}/entradas", {"nombre": "Tanda 4", "tipo": "tanda", "precio_virtual": 12000, "precio_puerta": 15000, "cupo": 200}, TA1), 201,
        lambda d: d["estado"] == "disponible" and d["tipo"] == "tanda" and d["cupo"] == 200)
chk("un cupo más y se pasa de la capacidad", pedir("POST", f"/boliches/{U}/eventos/{EV}/entradas", {"nombre": "Una de más", "precio_virtual": 1, "precio_puerta": 1, "cupo": 1}, TA1), 400, lambda d: "capacidad" in d["mensaje"])
chk("el mismo evento admite el mismo nombre solo una vez (sin importar mayúsculas)", pedir("POST", f"/boliches/{U}/eventos/{EV_RETRO}/entradas", {"nombre": "GENERAL", "precio_virtual": 1, "precio_puerta": 1, "cupo": 10}, TA1), 409)
chk("otro evento SÍ puede tener una entrada con ese nombre", pedir("POST", f"/boliches/{U}/eventos/{EV_RETRO}/entradas", {"nombre": "VIP", "tipo": "vip", "precio_virtual": 30000, "precio_puerta": 35000, "cupo": 20}, TA1), 201)
chk("precio negativo", pedir("POST", f"/boliches/{U}/eventos/{EV_RETRO}/entradas", {"nombre": "Mala", "precio_virtual": -5, "precio_puerta": 1, "cupo": 1}, TA1), 400)
chk("precio con decimales (los precios son pesos enteros)", pedir("POST", f"/boliches/{U}/eventos/{EV_RETRO}/entradas", {"nombre": "Mala2", "precio_virtual": 10.5, "precio_puerta": 1, "cupo": 1}, TA1), 400)
chk("cupo cero", pedir("POST", f"/boliches/{U}/eventos/{EV_RETRO}/entradas", {"nombre": "Mala3", "precio_virtual": 1, "precio_puerta": 1, "cupo": 0}, TA1), 400)
chk("tipo inválido", pedir("POST", f"/boliches/{U}/eventos/{EV_RETRO}/entradas", {"nombre": "Mala4", "tipo": "gold", "precio_virtual": 1, "precio_puerta": 1, "cupo": 1}, TA1), 400)
chk("estado inválido", pedir("POST", f"/boliches/{U}/eventos/{EV_RETRO}/entradas", {"nombre": "Mala5", "estado": "vendida", "precio_virtual": 1, "precio_puerta": 1, "cupo": 1}, TA1), 400)
chk("sin nombre", pedir("POST", f"/boliches/{U}/eventos/{EV_RETRO}/entradas", {"precio_virtual": 1, "precio_puerta": 1, "cupo": 1}, TA1), 400)
chk("sin precio de puerta", pedir("POST", f"/boliches/{U}/eventos/{EV_RETRO}/entradas", {"nombre": "Sin puerta", "precio_virtual": 1, "cupo": 1}, TA1), 400)
chk("el manager NO crea entradas", pedir("POST", f"/boliches/{U}/eventos/{EV_RETRO}/entradas", {"nombre": "M", "precio_virtual": 1, "precio_puerta": 1, "cupo": 1}, TM), 403)
chk("el RRPP NO crea entradas", pedir("POST", f"/boliches/{U}/eventos/{EV_RETRO}/entradas", {"nombre": "R", "precio_virtual": 1, "precio_puerta": 1, "cupo": 1}, TR), 403)
chk("el admin de otro boliche NO crea -> 404", pedir("POST", f"/boliches/{U}/eventos/{EV_RETRO}/entradas", {"nombre": "A2", "precio_virtual": 1, "precio_puerta": 1, "cupo": 1}, TA2), 404)

idE = e["id_tipo_entrada"]
chk("pasar una tanda a agotada", pedir("PUT", f"/boliches/{U}/eventos/{EV}/entradas/{idE}", {"estado": "agotada"}, TA1), 200, lambda d: d["estado"] == "agotada")
chk("subir el cupo por encima de la capacidad", pedir("PUT", f"/boliches/{U}/eventos/{EV}/entradas/{idE}", {"cupo": 201}, TA1), 400)
chk("bajar el cupo", pedir("PUT", f"/boliches/{U}/eventos/{EV}/entradas/{idE}", {"cupo": 150, "precio_virtual": 13000}, TA1), 200, lambda d: d["cupo"] == 150 and d["precio_virtual"] == 13000)
chk("editar sin mandar nada", pedir("PUT", f"/boliches/{U}/eventos/{EV}/entradas/{idE}", {}, TA1), 400)
chk("el manager NO edita", pedir("PUT", f"/boliches/{U}/eventos/{EV}/entradas/{idE}", {"estado": "disponible"}, TM), 403)
chk("el admin de otro boliche NO edita -> 404", pedir("PUT", f"/boliches/{U}/eventos/{EV}/entradas/{idE}", {"estado": "disponible"}, TA2), 404)
chk("una entrada de otro evento no se edita desde este -> 404", pedir("PUT", f"/boliches/{U}/eventos/{EV_RETRO}/entradas/{idE}", {"estado": "disponible"}, TA1), 404)
chk("liberar cupo permite repartirlo (150 + 50 = 200 de los 200 que había)", pedir("POST", f"/boliches/{U}/eventos/{EV}/entradas", {"nombre": "Extra", "precio_virtual": 5000, "precio_puerta": 6000, "cupo": 50}, TA1), 201)
chk("la capacidad ahora no baja de lo repartido (900)", pedir("PUT", f"/boliches/{U}", {"capacidad": 899}, TA1), 400)
chk("el manager NO borra", pedir("DELETE", f"/boliches/{U}/eventos/{EV}/entradas/{idE}", None, TM), 403)
chk("el admin de otro boliche NO borra -> 404", pedir("DELETE", f"/boliches/{U}/eventos/{EV}/entradas/{idE}", None, TA2), 404)
chk("el admin borra la entrada", pedir("DELETE", f"/boliches/{U}/eventos/{EV}/entradas/{idE}", None, TA1), 200)
chk("borrarla de nuevo -> 404", pedir("DELETE", f"/boliches/{U}/eventos/{EV}/entradas/{idE}", None, TA1), 404)

print("== Sin capacidad definida no hay entradas ==")
nuevo = chk("el superadmin crea un boliche sin capacidad", pedir("POST", "/boliches", {"nombre": "Pub Cinco", "subdominio": "pub-cinco", "admin": {"nombre": "Eva", "apellido": "Cinco", "email": "admin5@demo.com", "password": "clave12345"}}, TS), 201)
ev5 = chk("evento en el boliche nuevo", pedir("POST", f"/boliches/{nuevo['id_boliche']}/eventos", {"nombre": "Inauguración", "fecha_hora": "2027-06-01T23:00:00-03:00"}, TS), 201)
chk("crear una entrada sin capacidad avisa qué hacer", pedir("POST", f"/boliches/{nuevo['id_boliche']}/eventos/{ev5['id_evento']}/entradas", {"nombre": "General", "precio_virtual": 1, "precio_puerta": 1, "cupo": 10}, TS), 400, lambda d: "capacidad" in d["mensaje"])
chk("con la capacidad definida sí se puede", pedir("PUT", f"/boliches/{nuevo['id_boliche']}", {"capacidad": 100}, TS), 200)
chk("ahora la entrada se crea", pedir("POST", f"/boliches/{nuevo['id_boliche']}/eventos/{ev5['id_evento']}/entradas", {"nombre": "General", "precio_virtual": 1, "precio_puerta": 1, "cupo": 10}, TS), 201)
chk("al borrar el evento se borran sus entradas", pedir("DELETE", f"/boliches/{nuevo['id_boliche']}/eventos/{ev5['id_evento']}", None, TS), 200)

# ---------------------------------------------------------------------------------------------------------
print("== Bebidas: la carta de cada boliche ==")
chk("el admin ve la carta", pedir("GET", f"/boliches/{U}/bebidas", None, TA1), 200, lambda d: len(d) == 7)
chk("el RRPP y el manager ven la carta", pedir("GET", f"/boliches/{U}/bebidas", None, TR), 200)
chk("la carta de Bar Dos es otra (1 bebida)", pedir("GET", f"/boliches/{D}/bebidas", None, TA1), 200, lambda d: len(d) == 1)
chk("el admin de otro boliche NO ve la carta -> 404", pedir("GET", f"/boliches/{U}/bebidas", None, TA2), 404)
chk("el cliente NO ve el panel de bebidas", pedir("GET", f"/boliches/{U}/bebidas", None, TC), 403)
b = chk("el admin agrega una bebida y queda guardada", pedir("POST", f"/boliches/{U}/bebidas", {"categoria": "Tragos", "nombre": "Daiquiri", "descripcion": "Ron, limón y azúcar", "precio": 5500}, TA1), 201,
        lambda d: d["disponible"] and d["precio"] == 5500 and d["imagen"] is None)
chk("queda en la lista (persistida)", pedir("GET", f"/boliches/{U}/bebidas", None, TA1), 200, lambda d: any(x["id_bebida"] == b["id_bebida"] for x in d) and len(d) == 8)
chk("mismo nombre y categoría en el mismo boliche (sin importar mayúsculas)", pedir("POST", f"/boliches/{U}/bebidas", {"categoria": "TRAGOS", "nombre": "daiquiri", "precio": 1}, TA1), 409)
chk("el mismo nombre en OTRO boliche está permitido", pedir("POST", f"/boliches/{D}/bebidas", {"categoria": "Tragos", "nombre": "Daiquiri", "precio": 4800}, TA1), 201)
chk("mismo nombre en otra categoría del mismo boliche", pedir("POST", f"/boliches/{U}/bebidas", {"categoria": "Sin alcohol", "nombre": "Daiquiri", "precio": 3000}, TA1), 201)
chk("precio negativo", pedir("POST", f"/boliches/{U}/bebidas", {"categoria": "Tragos", "nombre": "Raro", "precio": -1}, TA1), 400)
chk("precio con decimales", pedir("POST", f"/boliches/{U}/bebidas", {"categoria": "Tragos", "nombre": "Raro", "precio": 99.9}, TA1), 400)
chk("precio que no es número", pedir("POST", f"/boliches/{U}/bebidas", {"categoria": "Tragos", "nombre": "Raro", "precio": "barato"}, TA1), 400)
chk("sin categoría", pedir("POST", f"/boliches/{U}/bebidas", {"nombre": "Raro", "precio": 5}, TA1), 400)
chk("sin nombre", pedir("POST", f"/boliches/{U}/bebidas", {"categoria": "Tragos", "precio": 5}, TA1), 400)
chk("sin precio", pedir("POST", f"/boliches/{U}/bebidas", {"categoria": "Tragos", "nombre": "Raro"}, TA1), 400)
chk("el manager NO agrega bebidas", pedir("POST", f"/boliches/{U}/bebidas", {"categoria": "Tragos", "nombre": "M", "precio": 5}, TM), 403)
chk("el RRPP NO agrega bebidas", pedir("POST", f"/boliches/{U}/bebidas", {"categoria": "Tragos", "nombre": "R", "precio": 5}, TR), 403)
chk("el admin de otro boliche NO agrega -> 404", pedir("POST", f"/boliches/{U}/bebidas", {"categoria": "Tragos", "nombre": "A2", "precio": 5}, TA2), 404)
chk("el admin edita el precio", pedir("PUT", f"/boliches/{U}/bebidas/{b['id_bebida']}", {"precio": 6000}, TA1), 200, lambda d: d["precio"] == 6000 and d["nombre"] == "Daiquiri")
chk("sacarla de la carta sin borrarla", pedir("PUT", f"/boliches/{U}/bebidas/{b['id_bebida']}", {"disponible": False}, TA1), 200, lambda d: d["disponible"] is False)
chk("la bebida no disponible NO sale en la página pública", pedir("GET", "/publico/boliches/boliche-uno"), 200, lambda d: all(x["nombre"] != "Daiquiri" or x["categoria"] != "Tragos" for x in d["bebidas"]))
chk("al volver a ponerla, sí sale", pedir("PUT", f"/boliches/{U}/bebidas/{b['id_bebida']}", {"disponible": True}, TA1), 200)
chk("y aparece en la página pública", pedir("GET", "/publico/boliches/boliche-uno"), 200, lambda d: any(x["nombre"] == "Daiquiri" and x["categoria"] == "Tragos" for x in d["bebidas"]))
chk("renombrar chocando con otra bebida de la categoría -> 409", pedir("PUT", f"/boliches/{U}/bebidas/{b['id_bebida']}", {"nombre": "FERNET con coca"}, TA1), 409)
chk("el admin de otro boliche NO edita -> 404", pedir("PUT", f"/boliches/{U}/bebidas/{b['id_bebida']}", {"precio": 1}, TA2), 404)
chk("una bebida de Bar Dos no se edita por Boliche Uno -> 404", pedir("PUT", f"/boliches/{U}/bebidas/{pedir('GET', f'/boliches/{D}/bebidas', None, TA1)[1][0]['id_bebida']}", {"precio": 1}, TA1), 404)
chk("el manager NO edita", pedir("PUT", f"/boliches/{U}/bebidas/{b['id_bebida']}", {"precio": 1}, TM), 403)
chk("el id debe ser un número", pedir("PUT", f"/boliches/{U}/bebidas/abc", {"precio": 1}, TA1), 400)

print("== Imágenes de las bebidas ==")
IMG = png()
r = chk("el admin sube la foto de la bebida", pedir("POST", f"/boliches/{U}/bebidas/{b['id_bebida']}/imagen", IMG, TA1, "image/png"), 201, lambda d: d["imagen"] and d["imagen"].startswith(f"/api/uploads/bebidas/{U}/"))
with urllib.request.urlopen(ORIGEN + r["imagen"]) as f:
    verdad("la imagen de la bebida se ve y es idéntica a la subida", f.read() == IMG)
primera = r["imagen"]
r = chk("subir otra reemplaza a la anterior", pedir("POST", f"/boliches/{U}/bebidas/{b['id_bebida']}/imagen", png(color=(9, 9, 9)), TA1, "image/png"), 201, lambda d: d["imagen"] != primera)
try:
    urllib.request.urlopen(ORIGEN + primera); verdad("la imagen anterior se borró del disco", False)
except urllib.error.HTTPError as ex:
    verdad("la imagen anterior se borró del disco", ex.code == 404)
chk("un archivo falso no se acepta como imagen", pedir("POST", f"/boliches/{U}/bebidas/{b['id_bebida']}/imagen", b"<script>alert(1)</script>", TA1, "image/png"), 415)
chk("el RRPP NO sube imágenes", pedir("POST", f"/boliches/{U}/bebidas/{b['id_bebida']}/imagen", IMG, TR, "image/png"), 403)
chk("el admin de otro boliche NO sube -> 404", pedir("POST", f"/boliches/{U}/bebidas/{b['id_bebida']}/imagen", IMG, TA2, "image/png"), 404)
chk("la imagen sale en la carta pública", pedir("GET", "/publico/boliches/boliche-uno"), 200, lambda d: any(x["imagen"] == r["imagen"] for x in d["bebidas"]))
chk("el admin quita la imagen", pedir("DELETE", f"/boliches/{U}/bebidas/{b['id_bebida']}/imagen", None, TA1), 200, lambda d: d["imagen"] is None)
try:
    urllib.request.urlopen(ORIGEN + r["imagen"]); verdad("al quitarla, el archivo se borra del disco", False)
except urllib.error.HTTPError as ex:
    verdad("al quitarla, el archivo se borra del disco", ex.code == 404)
r = pedir("POST", f"/boliches/{U}/bebidas/{b['id_bebida']}/imagen", IMG, TA1, "image/png")[1]
chk("el manager NO borra bebidas", pedir("DELETE", f"/boliches/{U}/bebidas/{b['id_bebida']}", None, TM), 403)
chk("el admin de otro boliche NO borra -> 404", pedir("DELETE", f"/boliches/{U}/bebidas/{b['id_bebida']}", None, TA2), 404)
chk("el admin borra la bebida", pedir("DELETE", f"/boliches/{U}/bebidas/{b['id_bebida']}", None, TA1), 200)
try:
    urllib.request.urlopen(ORIGEN + r["imagen"]); verdad("borrar la bebida borra también su imagen del disco", False)
except urllib.error.HTTPError as ex:
    verdad("borrar la bebida borra también su imagen del disco", ex.code == 404)
chk("borrarla de nuevo -> 404", pedir("DELETE", f"/boliches/{U}/bebidas/{b['id_bebida']}", None, TA1), 404)

# ---------------------------------------------------------------------------------------------------------
print("== Mesas VIP ==")
chk("el admin ve las mesas del boliche", pedir("GET", f"/boliches/{U}/mesas-vip", None, TA1), 200, lambda d: len(d) == 3)
chk("el RRPP las ve", pedir("GET", f"/boliches/{U}/mesas-vip", None, TR), 200)
chk("el admin de otro boliche no las ve -> 404", pedir("GET", f"/boliches/{U}/mesas-vip", None, TA2), 404)
m = chk("el admin crea una mesa", pedir("POST", f"/boliches/{U}/mesas-vip", {"nombre": "Mesa Terraza", "capacidad": 12, "precio": 250000, "descripcion": "Con vista a la pista"}, TA1), 201, lambda d: d["activa"] and d["capacidad"] == 12)
chk("nombre repetido en el mismo boliche (sin importar mayúsculas)", pedir("POST", f"/boliches/{U}/mesas-vip", {"nombre": "mesa terraza", "capacidad": 4, "precio": 1}, TA1), 409)
chk("el mismo nombre en otro boliche está permitido", pedir("POST", f"/boliches/{D}/mesas-vip", {"nombre": "Mesa Terraza", "capacidad": 4, "precio": 90000}, TA1), 201)
chk("capacidad cero", pedir("POST", f"/boliches/{U}/mesas-vip", {"nombre": "Rara", "capacidad": 0, "precio": 1}, TA1), 400)
chk("precio negativo", pedir("POST", f"/boliches/{U}/mesas-vip", {"nombre": "Rara", "capacidad": 4, "precio": -1}, TA1), 400)
chk("sin precio", pedir("POST", f"/boliches/{U}/mesas-vip", {"nombre": "Rara", "capacidad": 4}, TA1), 400)
chk("el manager NO crea mesas", pedir("POST", f"/boliches/{U}/mesas-vip", {"nombre": "M", "capacidad": 4, "precio": 1}, TM), 403)
chk("el admin de otro boliche NO crea -> 404", pedir("POST", f"/boliches/{U}/mesas-vip", {"nombre": "A2", "capacidad": 4, "precio": 1}, TA2), 404)
chk("el admin edita la mesa", pedir("PUT", f"/boliches/{U}/mesas-vip/{m['id_mesa']}", {"precio": 280000, "capacidad": 14}, TA1), 200, lambda d: d["precio"] == 280000 and d["capacidad"] == 14)
chk("la mesa de otro boliche no se edita desde este -> 404", pedir("PUT", f"/boliches/{U}/mesas-vip/{pedir('GET', f'/boliches/{D}/mesas-vip', None, TA1)[1][0]['id_mesa']}", {"precio": 1}, TA1), 404)
chk("subir foto de la mesa", pedir("POST", f"/boliches/{U}/mesas-vip/{m['id_mesa']}/imagen", IMG, TA1, "image/png"), 201, lambda d: d["imagen"].startswith(f"/api/uploads/mesas/{U}/"))
chk("un archivo falso como foto de mesa", pedir("POST", f"/boliches/{U}/mesas-vip/{m['id_mesa']}/imagen", b"nada", TA1, "image/png"), 415)

print("== Mesas VIP que ofrece cada evento ==")
chk("el RRPP ve las mesas del evento y cuáles ofrece", pedir("GET", f"/boliches/{U}/eventos/{EV}/mesas-vip", None, TR), 200, lambda d: len(d) == 4 and sum(x["ofrecida"] for x in d) == 2)
chk("el evento ofrece la mesa nueva", pedir("PUT", f"/boliches/{U}/eventos/{EV}/mesas-vip/{m['id_mesa']}", {"ofrecida": True}, TA1), 200, lambda d: next(x for x in d if x["id_mesa"] == m["id_mesa"])["estado"] == "disponible")
chk("marcarla reservada", pedir("PUT", f"/boliches/{U}/eventos/{EV}/mesas-vip/{m['id_mesa']}", {"ofrecida": True, "estado": "reservada"}, TA1), 200, lambda d: next(x for x in d if x["id_mesa"] == m["id_mesa"])["estado"] == "reservada")
chk("ofrecerla de nuevo no pisa el estado si no se manda", pedir("PUT", f"/boliches/{U}/eventos/{EV}/mesas-vip/{m['id_mesa']}", {"ofrecida": True}, TA1), 200, lambda d: next(x for x in d if x["id_mesa"] == m["id_mesa"])["estado"] == "reservada")
chk("estado inválido", pedir("PUT", f"/boliches/{U}/eventos/{EV}/mesas-vip/{m['id_mesa']}", {"ofrecida": True, "estado": "vendida"}, TA1), 400)
chk("falta indicar si la ofrece", pedir("PUT", f"/boliches/{U}/eventos/{EV}/mesas-vip/{m['id_mesa']}", {"estado": "reservada"}, TA1), 400)
chk("en la página pública las mesas del evento traen su estado", pedir("GET", "/publico/boliches/boliche-uno"), 200,
    lambda d: next(e for e in d["eventos"] if e["id_evento"] == EV)["mesas_vip"] and any(x["id_mesa"] == m["id_mesa"] and x["estado"] == "reservada" for x in next(e for e in d["eventos"] if e["id_evento"] == EV)["mesas_vip"]))
chk("el manager NO cambia las mesas del evento", pedir("PUT", f"/boliches/{U}/eventos/{EV}/mesas-vip/{m['id_mesa']}", {"ofrecida": False}, TM), 403)
chk("el admin de otro boliche NO -> 404", pedir("PUT", f"/boliches/{U}/eventos/{EV}/mesas-vip/{m['id_mesa']}", {"ofrecida": False}, TA2), 404)
chk("una mesa de otro boliche NO se puede ofrecer en este evento -> 404", pedir("PUT", f"/boliches/{U}/eventos/{EV}/mesas-vip/{pedir('GET', f'/boliches/{D}/mesas-vip', None, TA1)[1][0]['id_mesa']}", {"ofrecida": True}, TA1), 404)
chk("un evento de otro boliche -> 404", pedir("PUT", f"/boliches/{U}/eventos/{EV_DOS}/mesas-vip/{m['id_mesa']}", {"ofrecida": True}, TA1), 404)
chk("el evento deja de ofrecerla", pedir("PUT", f"/boliches/{U}/eventos/{EV}/mesas-vip/{m['id_mesa']}", {"ofrecida": False}, TA1), 200, lambda d: not next(x for x in d if x["id_mesa"] == m["id_mesa"])["ofrecida"])
chk("desactivar la mesa la saca de la página pública", pedir("PUT", f"/boliches/{U}/mesas-vip/{m['id_mesa']}", {"activa": False}, TA1), 200, lambda d: d["activa"] is False)
chk("y ya no figura entre las mesas del boliche", pedir("GET", "/publico/boliches/boliche-uno"), 200, lambda d: all(x["id_mesa"] != m["id_mesa"] for x in d["mesas_vip"]))
chk("el manager NO borra mesas", pedir("DELETE", f"/boliches/{U}/mesas-vip/{m['id_mesa']}", None, TM), 403)
chk("el admin borra la mesa", pedir("DELETE", f"/boliches/{U}/mesas-vip/{m['id_mesa']}", None, TA1), 200)
chk("borrarla de nuevo -> 404", pedir("DELETE", f"/boliches/{U}/mesas-vip/{m['id_mesa']}", None, TA1), 404)

# ---------------------------------------------------------------------------------------------------------
print("== Colores del boliche (modo claro y oscuro) ==")
chk("sin personalizar, rige el negro y dorado", pedir("GET", f"/boliches/{U}/tema", None, TA1), 200,
    lambda d: d["oscuro"]["acento"] == "#D4AF37" and d["oscuro"]["fondo"] == "#0B0B0B" and d["claro"]["fondo"] == "#FAF7F0" and not d["personalizado"]["oscuro"])
chk("el RRPP ve los colores", pedir("GET", f"/boliches/{U}/tema", None, TR), 200)
chk("el manager ve los colores", pedir("GET", f"/boliches/{U}/tema", None, TM), 200)
chk("el admin de otro boliche no los ve -> 404", pedir("GET", f"/boliches/{U}/tema", None, TA2), 404)
violeta = {"modo": "oscuro", "fondo": "#10051F", "tarjetas": "#1B0B33", "texto": "#F3E8FF", "acento": "#C084FC"}
chk("el admin guarda un tema oscuro", pedir("PUT", f"/boliches/{U}/tema", violeta, TA1), 200, lambda d: d["oscuro"]["acento"] == "#C084FC" and d["personalizado"]["oscuro"] and not d["personalizado"]["claro"])
chk("el otro modo no se tocó", pedir("GET", f"/boliches/{U}/tema", None, TA1), 200, lambda d: d["claro"]["acento"] == "#A67C00")
chk("la página pública usa los colores del boliche", pedir("GET", "/publico/boliches/boliche-uno"), 200, lambda d: d["tema"]["oscuro"]["acento"] == "#C084FC" and d["tema"]["claro"]["fondo"] == "#FAF7F0")
chk("los otros boliches siguen con el negro y dorado", pedir("GET", "/publico/boliches/bar-dos"), 200, lambda d: d["tema"]["oscuro"]["acento"] == "#D4AF37")
chk("los colores se normalizan en mayúsculas", pedir("PUT", f"/boliches/{U}/tema", {**violeta, "acento": "#c084fc"}, TA1), 200, lambda d: d["oscuro"]["acento"] == "#C084FC")
chk("texto casi igual al fondo (contraste bajo) -> 400", pedir("PUT", f"/boliches/{U}/tema", {**violeta, "texto": "#1A0A30"}, TA1), 400, lambda d: "contraste" in d["mensaje"])
chk("texto gris sobre fondo gris -> 400", pedir("PUT", f"/boliches/{U}/tema", {"modo": "claro", "fondo": "#999999", "tarjetas": "#AAAAAA", "texto": "#777777", "acento": "#888888"}, TA1), 400)
chk("acento invisible sobre el fondo -> 400", pedir("PUT", f"/boliches/{U}/tema", {**violeta, "acento": "#12062A"}, TA1), 400, lambda d: "acento" in d["mensaje"])
chk("texto ilegible sobre las tarjetas -> 400", pedir("PUT", f"/boliches/{U}/tema", {**violeta, "tarjetas": "#E9D5FF"}, TA1), 400, lambda d: "tarjetas" in d["mensaje"])
chk("color que no es #RRGGBB", pedir("PUT", f"/boliches/{U}/tema", {**violeta, "fondo": "negro"}, TA1), 400)
chk("color con formato corto (#FFF)", pedir("PUT", f"/boliches/{U}/tema", {**violeta, "fondo": "#000"}, TA1), 400)
chk("color con código inyectado", pedir("PUT", f"/boliches/{U}/tema", {**violeta, "fondo": "#000000;}</style><script>"}, TA1), 400)
chk("falta un color", pedir("PUT", f"/boliches/{U}/tema", {"modo": "oscuro", "fondo": "#000000", "texto": "#FFFFFF", "acento": "#D4AF37"}, TA1), 400)
chk("modo inválido", pedir("PUT", f"/boliches/{U}/tema", {**violeta, "modo": "sepia"}, TA1), 400)
chk("el manager NO cambia los colores", pedir("PUT", f"/boliches/{U}/tema", violeta, TM), 403)
chk("el RRPP NO cambia los colores", pedir("PUT", f"/boliches/{U}/tema", violeta, TR), 403)
chk("el admin de otro boliche NO cambia los colores -> 404", pedir("PUT", f"/boliches/{U}/tema", violeta, TA2), 404)
chk("restablecer un solo modo", pedir("DELETE", f"/boliches/{U}/tema?modo=oscuro", None, TA1), 200, lambda d: d["oscuro"]["acento"] == "#D4AF37" and not d["personalizado"]["oscuro"])
chk("modo inválido al restablecer", pedir("DELETE", f"/boliches/{U}/tema?modo=sepia", None, TA1), 400)
pedir("PUT", f"/boliches/{U}/tema", violeta, TA1); pedir("PUT", f"/boliches/{U}/tema", {"modo": "claro", "fondo": "#FFF8E7", "tarjetas": "#FFFFFF", "texto": "#2B2B2B", "acento": "#7A5C00"}, TA1)
chk("restablecer los dos modos", pedir("DELETE", f"/boliches/{U}/tema", None, TA1), 200, lambda d: not d["personalizado"]["oscuro"] and not d["personalizado"]["claro"])
chk("el manager NO restablece", pedir("DELETE", f"/boliches/{U}/tema", None, TM), 403)

# ---------------------------------------------------------------------------------------------------------
print("== Página pública: lo que ve cualquiera ==")
pub = pedir("GET", "/publico/boliches/boliche-uno")[1]
claves = set(pub)
verdad("trae la ficha, fotos, colores, carta, mesas y eventos", {"descripcion", "direccion", "latitud", "longitud", "capacidad", "fotos", "tema", "bebidas", "mesas_vip", "eventos"} <= claves)
verdad("NO trae datos internos (cobro, equipo, admins, activo)", not ({"tipo_cobro", "monto_mensual", "equipo", "admins", "activo"} & claves))
ev_pub = next(e for e in pub["eventos"] if e["id_evento"] == EV)
verdad("las entradas públicas NO muestran el cupo", all("cupo" not in x for x in ev_pub["entradas"]))
verdad("las entradas públicas traen precio virtual, precio de puerta y estado", all({"nombre", "tipo", "precio_virtual", "precio_puerta", "estado"} <= set(x) for x in ev_pub["entradas"]))
verdad("una entrada agotada y una no disponible se muestran (con su estado)", {"agotada", "no_disponible"} <= {x["estado"] for x in ev_pub["entradas"]})
verdad("las bebidas públicas no traen ids de otros boliches ni datos internos", all("id_boliche" not in x and "disponible" not in x for x in pub["bebidas"]))
cancelado = chk("evento nuevo para cancelar", pedir("POST", f"/boliches/{U}/eventos", {"nombre": "Cancelada secreta", "fecha_hora": "2027-07-01T23:00:00-03:00"}, TA1), 201)
verdad("un evento publicado sale en la página pública", any(e["nombre"] == "Cancelada secreta" for e in pedir("GET", "/publico/boliches/boliche-uno")[1]["eventos"]))
chk("se cancela", pedir("PUT", f"/boliches/{U}/eventos/{cancelado['id_evento']}", {"estado": "cancelado"}, TA1), 200)
verdad("un evento cancelado NO sale en la página pública", all(e["nombre"] != "Cancelada secreta" for e in pedir("GET", "/publico/boliches/boliche-uno")[1]["eventos"]))
chk("un boliche que no existe -> 404", pedir("GET", "/publico/boliches/no-existe"), 404)
chk("el listado público trae la portada y la ubicación", pedir("GET", "/publico/boliches"), 200, lambda d: all({"portada", "direccion", "capacidad"} <= set(x) for x in d) and len(d) == 4)
chk("el boliche desactivado desaparece del público", pedir("PUT", f"/boliches/{nuevo['id_boliche']}", {"activo": False}, TS), 200)
chk("... y devuelve 404", pedir("GET", "/publico/boliches/pub-cinco"), 404)
chk("... y no está en el listado", pedir("GET", "/publico/boliches"), 200, lambda d: all(x["subdominio"] != "pub-cinco" for x in d))

print("\nFALLAS:", fallas or "ninguna")
sys.exit(1 if fallas else 0)
