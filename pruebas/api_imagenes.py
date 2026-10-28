"""Pruebas de la subida de imágenes (fotos de los boliches y flyers de los eventos).
Se corren igual que api_plataforma.py: contra una base recién cargada y con el backend levantado.
    API=http://localhost:3000/api python3 pruebas/api_imagenes.py
"""
import json, os, struct, sys, urllib.request, urllib.error, zlib
B = os.environ.get("API", "http://localhost:3000/api")
ORIGEN = B.rsplit("/api", 1)[0]

def png(ancho=4, alto=4, color=(200, 30, 60)):
    """Un PNG válido mínimo, armado a mano (no hace falta ninguna librería)."""
    def trozo(tipo, datos):
        c = struct.pack(">I", len(datos)) + tipo + datos
        return c + struct.pack(">I", zlib.crc32(tipo + datos) & 0xFFFFFFFF)
    filas = b"".join(b"\x00" + bytes(color) * ancho for _ in range(alto))
    return b"\x89PNG\r\n\x1a\n" + trozo(b"IHDR", struct.pack(">IIBBBBB", ancho, alto, 8, 2, 0, 0, 0)) + trozo(b"IDAT", zlib.compress(filas)) + trozo(b"IEND", b"")

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
    print(("OK   " if ok else "FALLA"), f"[{resp[0]}]", nombre, "" if ok else "-> " + json.dumps(resp[1], ensure_ascii=False)[:200])
    if not ok: fallas.append(nombre)
    return resp[1]

def entrar(email):
    s, d = pedir("POST", "/auth/login", {"email": email, "password": "demo12345"})
    return d["token"], d["usuario"]

TA1, UA1 = entrar("admin1@demo.com"); TA2, _ = entrar("admin2@demo.com"); TM, _ = entrar("manager1@demo.com")
TR, _ = entrar("rrpp1@demo.com"); TS, _ = entrar("superadmin@demo.com"); TC, _ = entrar("cliente@demo.com")
ids = {b["nombre"]: b["id_boliche"] for b in UA1["boliches"]}; U = ids["Boliche Uno"]; D = ids["Bar Dos"]
IMG = png()

print("== Fotos del boliche ==")
r = chk("el admin sube una foto PNG (la primera queda de portada)", pedir("POST", f"/boliches/{U}/fotos", IMG, TA1, "image/png"), 201, lambda d: len(d) == 1 and d[0]["es_portada"] and d[0]["url"].startswith(f"/api/uploads/boliches/{U}/") and d[0]["url"].endswith(".png"))
url = r[0]["url"]; id_primera = r[0]["id_foto"]
with urllib.request.urlopen(ORIGEN + url) as f:
    visto = f.read(); cab = f.headers
print(("OK   " if visto == IMG else "FALLA"), "la foto se puede ver en su dirección y es idéntica a la subida"); fallas += [] if visto == IMG else ["ver foto"]
print(("OK   " if cab.get("X-Content-Type-Options") == "nosniff" and cab.get("Content-Type") == "image/png" else "FALLA"), "se sirve como image/png y con nosniff"); fallas += [] if (cab.get("X-Content-Type-Options") == "nosniff" and cab.get("Content-Type") == "image/png") else ["cabeceras"]
chk("la foto aparece en la página pública", pedir("GET", "/publico/boliches/boliche-uno"), 200, lambda d: url in [f["url"] for f in d["fotos"]])
r2 = chk("el superadmin también puede subir (la segunda NO es portada)", pedir("POST", f"/boliches/{U}/fotos", png(color=(0, 0, 255)), TS, "image/png"), 201, lambda d: len(d) == 2 and sum(f["es_portada"] for f in d) == 1)
foto2 = [f for f in r2 if not f["es_portada"]][0]; id_segunda = foto2["id_foto"]; url_segunda = foto2["url"]
chk("cambiar la portada deja una sola portada", pedir("PUT", f"/boliches/{U}/fotos/{id_segunda}", {"es_portada": True}, TA1), 200, lambda d: d[0]["id_foto"] == id_segunda and sum(f["es_portada"] for f in d) == 1)
chk("la portada sale primera en el listado del admin", pedir("GET", f"/boliches/{U}/fotos", None, TA1), 200, lambda d: d[0]["es_portada"])
chk("la lectura de las fotos también la ve el RRPP", pedir("GET", f"/boliches/{U}/fotos", None, TR), 200)

print("== Archivos que NO son imágenes ==")
chk("un HTML disfrazado de imagen (dice image/png)", pedir("POST", f"/boliches/{U}/fotos", b"<html><script>alert(1)</script></html>", TA1, "image/png"), 415)
chk("un ejecutable disfrazado", pedir("POST", f"/boliches/{U}/fotos", b"MZ\x90\x00" + b"\x00" * 100, TA1, "image/jpeg"), 415)
chk("un SVG (puede llevar scripts)", pedir("POST", f"/boliches/{U}/fotos", b"<svg xmlns='http://www.w3.org/2000/svg'><script>1</script></svg>", TA1, "image/svg+xml"), 415)
chk("un archivo vacío", pedir("POST", f"/boliches/{U}/fotos", b"", TA1, "image/png"), 415)
chk("sin el tipo correcto (application/json)", pedir("POST", f"/boliches/{U}/fotos", IMG, TA1, "application/json"), 400)
chk("demasiado grande (6 MB)", pedir("POST", f"/boliches/{U}/fotos", IMG + b"\x00" * (6 * 1024 * 1024), TA1, "image/png"), 413)

print("== Quién puede subir y a qué local ==")
chk("admin de OTRO boliche -> 404", pedir("POST", f"/boliches/{U}/fotos", IMG, TA2, "image/png"), 404)
chk("el manager NO sube fotos del local", pedir("POST", f"/boliches/{U}/fotos", IMG, TM, "image/png"), 403)
chk("el RRPP NO sube", pedir("POST", f"/boliches/{U}/fotos", IMG, TR, "image/png"), 403)
chk("el cliente NO sube", pedir("POST", f"/boliches/{U}/fotos", IMG, TC, "image/png"), 403)
chk("sin sesión", pedir("POST", f"/boliches/{U}/fotos", IMG, None, "image/png"), 401)
chk("admin2 NO borra fotos de otro local", pedir("DELETE", f"/boliches/{U}/fotos/{id_primera}", None, TA2), 404)
chk("admin2 NO cambia la portada de otro local", pedir("PUT", f"/boliches/{U}/fotos/{id_primera}", {"es_portada": True}, TA2), 404)
chk("no se puede 'editar' las fotos por el PUT del boliche", pedir("PUT", f"/boliches/{U}", {"fotos": ["https://malo.com/x.png"]}, TA1), 403)
chk("no se borra una foto con un id que no es de este boliche", pedir("DELETE", f"/boliches/{U}/fotos/999999", None, TA1), 404)
chk("el id de la foto debe ser un número (nada de rutas)", pedir("DELETE", f"/boliches/{U}/fotos/..%2F..%2Fetc%2Fpasswd", None, TA1), 400)
chk("una foto de Bar Dos no se borra desde Boliche Uno", pedir("DELETE", f"/boliches/{U}/fotos/{pedir('POST', f'/boliches/{D}/fotos', png(color=(5, 5, 5)), TA1, 'image/png')[1][0]['id_foto']}", None, TA1), 404)

print("== Límite de fotos y borrado ==")
for _ in range(10 - 2): pedir("POST", f"/boliches/{U}/fotos", png(color=(1, 2, 3)), TA1, "image/png")
chk("más de 10 fotos", pedir("POST", f"/boliches/{U}/fotos", IMG, TA1, "image/png"), 400)
carpeta = os.path.join(os.environ.get("UPLOADS_DIR", "uploads"), "boliches", str(U))
if os.path.isdir(carpeta):
    n = len(os.listdir(carpeta)); print(("OK   " if n == 10 else "FALLA"), f"el intento de la foto 11 no dejó un archivo huérfano en disco ({n} archivos)"); fallas += [] if n == 10 else ["huérfano"]
chk("el admin borra la foto portada", pedir("DELETE", f"/boliches/{U}/fotos/{id_segunda}", None, TA1), 200, lambda d: id_segunda not in [f["id_foto"] for f in d] and len(d) == 9 and sum(f["es_portada"] for f in d) == 1)
try:
    urllib.request.urlopen(ORIGEN + url_segunda); print("FALLA la foto borrada sigue viéndose"); fallas.append("archivo borrado")
except urllib.error.HTTPError as e:
    print(("OK   " if e.code == 404 else "FALLA"), f"[{e.code}] la foto borrada ya no se ve")

print("== Flyer de los eventos ==")
ev = chk("evento nuevo", pedir("POST", f"/boliches/{U}/eventos", {"nombre": "Con flyer", "fecha_hora": "2027-05-01T23:00:00-03:00"}, TA1), 201)
em = chk("evento del manager", pedir("POST", f"/boliches/{U}/eventos", {"nombre": "Del manager", "fecha_hora": "2027-05-02T23:00:00-03:00"}, TM), 201)
r = chk("el admin sube el flyer", pedir("POST", f"/boliches/{U}/eventos/{ev['id_evento']}/imagen", IMG, TA1, "image/png"), 201, lambda d: d["imagen"] and d["imagen"].startswith(f"/api/uploads/eventos/{U}/"))
viejo = r["imagen"]
r = chk("al subir otro, reemplaza al anterior", pedir("POST", f"/boliches/{U}/eventos/{ev['id_evento']}/imagen", png(color=(9, 9, 9)), TA1, "image/png"), 201, lambda d: d["imagen"] != viejo)
try:
    urllib.request.urlopen(ORIGEN + viejo); print("FALLA el flyer anterior quedó en disco"); fallas.append("flyer viejo")
except urllib.error.HTTPError as e:
    print(("OK   " if e.code == 404 else "FALLA"), f"[{e.code}] el flyer anterior se borró del disco")
chk("el flyer sale en la página pública", pedir("GET", "/publico/boliches/boliche-uno"), 200, lambda d: any(e["imagen"] == r["imagen"] for e in d["eventos"]))
chk("el manager sube el flyer de SU evento", pedir("POST", f"/boliches/{U}/eventos/{em['id_evento']}/imagen", IMG, TM, "image/png"), 201)
chk("el manager NO toca el flyer del evento del admin", pedir("POST", f"/boliches/{U}/eventos/{ev['id_evento']}/imagen", IMG, TM, "image/png"), 403)
chk("el RRPP NO sube flyers", pedir("POST", f"/boliches/{U}/eventos/{ev['id_evento']}/imagen", IMG, TR, "image/png"), 403)
chk("admin de otro boliche -> 404", pedir("POST", f"/boliches/{U}/eventos/{ev['id_evento']}/imagen", IMG, TA2, "image/png"), 404)
chk("un archivo falso como flyer", pedir("POST", f"/boliches/{U}/eventos/{ev['id_evento']}/imagen", b"no soy una imagen", TA1, "image/png"), 415)
chk("el admin quita el flyer", pedir("DELETE", f"/boliches/{U}/eventos/{ev['id_evento']}/imagen", None, TA1), 200, lambda d: d["imagen"] is None)
chk("borrar el evento borra su flyer también", pedir("DELETE", f"/boliches/{U}/eventos/{em['id_evento']}", None, TA1), 200)

print("\nFALLAS:", fallas or "ninguna")
sys.exit(1 if fallas else 0)
