"""Ayudas compartidas por las pruebas de las fases 2 a 6 (cada archivo de prueba corre solo, contra una base recién cargada).
Variables: API (por defecto http://localhost:3000/api). Para las comprobaciones que tocan la base directo (vencimientos,
borrado de datos) hacen falta PGHOST, PGPORT, PGUSER, PGPASSWORD y PGDATABASE; si faltan, esas líneas se saltean."""
import json, os, struct, subprocess, sys, urllib.request, urllib.error, zlib
B = os.environ.get("API", "http://localhost:3000/api")
ORIGEN = B.rsplit("/api", 1)[0]
fallas = []


def png(color=(200, 30, 60)):
    def trozo(tipo, datos):
        c = struct.pack(">I", len(datos)) + tipo + datos
        return c + struct.pack(">I", zlib.crc32(tipo + datos) & 0xFFFFFFFF)
    filas = b"".join(b"\x00" + bytes(color) * 4 for _ in range(4))
    return b"\x89PNG\r\n\x1a\n" + trozo(b"IHDR", struct.pack(">IIBBBBB", 4, 4, 8, 2, 0, 0, 0)) + trozo(b"IDAT", zlib.compress(filas)) + trozo(b"IEND", b"")


def pedir(metodo, ruta, cuerpo=None, token=None, tipo="application/json", cabeceras=None):
    datos = cuerpo if isinstance(cuerpo, (bytes, bytearray)) else (json.dumps(cuerpo).encode() if cuerpo is not None else None)
    cab = {"Content-Type": tipo, **({"Authorization": "Bearer " + token} if token else {}), **(cabeceras or {})}
    req = urllib.request.Request(B + ruta, method=metodo, data=datos, headers=cab)
    try:
        r = urllib.request.urlopen(req)
        return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        try: d = json.loads(e.read())
        except Exception: d = {}
        return e.code, d


def chk(nombre, resp, esperado, cond=None):
    ok = resp[0] == esperado and (cond is None or cond(resp[1]))
    print(("OK   " if ok else "FALLA"), f"[{resp[0]}]", nombre, "" if ok else "-> " + json.dumps(resp[1], ensure_ascii=False)[:240])
    if not ok: fallas.append(nombre)
    return resp[1]


def verdad(nombre, condicion):
    print(("OK   " if condicion else "FALLA"), nombre)
    if not condicion: fallas.append(nombre)


def entrar(email, clave="demo12345"):
    s, d = pedir("POST", "/auth/login", {"email": email, "password": clave})
    assert s == 200, (email, d)
    return d["token"], d["usuario"]


def sql(consulta):
    """Corre una consulta directo en la base (solo para lo que la API no permite hacer, como envejecer fechas). None si no hay conexión."""
    if not os.environ.get("PGDATABASE"):
        return None
    r = subprocess.run(["psql", "-v", "ON_ERROR_STOP=1", "-Atq", "-c", consulta], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr)
    return r.stdout.strip()


def saltear(nombre):
    print("SALTEADO", nombre, "(sin conexión a la base)")


def fin():
    print("\nFALLAS:", fallas or "ninguna")
    sys.exit(1 if fallas else 0)
