"""Pruebas de la fase 6 que necesitan un servidor con otra configuración: la verificación en dos pasos OBLIGATORIA (un admin sin
activarla entra con una sesión limitada) y el límite de inicios de sesión por dirección. Levanta su propio servidor en el puerto 3912.
Hace falta PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE (una base recién cargada); el JWT_SECRET sale del .env del proyecto.
    python3 pruebas/api_fase6_servicios.py"""
import os, subprocess, time, urllib.request

os.environ["API"] = "http://127.0.0.1:3912/api"
from comun import chk, fin, pedir, totp, verdad

raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
entorno = {**os.environ, "PORT": "3912", "DB_HOST": os.environ["PGHOST"], "DB_PORT": os.environ["PGPORT"], "DB_USER": os.environ["PGUSER"],
           "DB_PASSWORD": os.environ["PGPASSWORD"], "DB_NAME": os.environ["PGDATABASE"], "VERIFICACION_ADMIN": "obligatoria", "LIMITE_LOGIN": "7", "TAREAS_AUTO": "false"}
servidor = subprocess.Popen(["node", "src/index.js"], cwd=raiz, env=entorno, stdout=open("/tmp/srv_fase6.log", "w"), stderr=subprocess.STDOUT)
login = lambda email, clave="demo12345": pedir("POST", "/auth/login", {"email": email, "password": clave})
try:
    for _ in range(40):
        try: urllib.request.urlopen("http://127.0.0.1:3912/api/publico/boliches"); break
        except Exception: time.sleep(0.25)

    print("== Verificación obligatoria ==")
    r = chk("el admin que no la activó entra con una sesión limitada y se le avisa que debe configurarla", login("admin1@demo.com"), 200, lambda d: d["debe_configurar_2fa"] is True and d["token"] and d["usuario"]["verificacion"]["obligatoria"])
    limitado = r["token"]
    chk("con esa sesión no puede usar el sistema -> 403", pedir("GET", "/boliches", None, limitado), 403, lambda d: d["requiere_2fa"] is True)
    chk("ni ver los eventos de su boliche -> 403", pedir("GET", "/boliches/1/eventos", None, limitado), 403)
    chk("ni crear nada -> 403", pedir("POST", "/boliches/1/bebidas", {"categoria": "X", "nombre": "Y", "precio": 1}, limitado), 403)
    chk("pero sí ve su perfil", pedir("GET", "/auth/perfil", None, limitado), 200, lambda d: d["verificacion"] == {"aplica": True, "activa": False, "obligatoria": True})
    sec = chk("y puede pedir el código QR para activarla", pedir("POST", "/auth/2fa/preparar", None, limitado), 200)["secreto"]
    chk("un código malo no la activa", pedir("POST", "/auth/2fa/activar", {"codigo": "000000" if totp(sec) != "000000" else "111111"}, limitado), 400)
    act = chk("con el código bueno la activa y recibe la sesión completa", pedir("POST", "/auth/2fa/activar", {"codigo": totp(sec)}, limitado), 200, lambda d: d["token"] and len(d["codigos_de_recuperacion"]) == 8)
    chk("con la sesión completa ya usa el sistema", pedir("GET", "/boliches", None, act["token"]), 200, lambda d: len(d) == 2)
    chk("la sesión limitada de antes sigue sin servir", pedir("GET", "/boliches", None, limitado), 403)
    chk("siendo obligatoria, no se puede desactivar -> 403", pedir("POST", "/auth/2fa/desactivar", {"password": "demo12345", "codigo": totp(sec, int(time.time() // 30) + 1)}, act["token"]), 403)
    chk("en el próximo login pide el segundo paso", login("admin1@demo.com"), 200, lambda d: d["requiere_verificacion"] and "token" not in d)
    chk("el superadmin también tiene que configurarla", login("superadmin@demo.com"), 200, lambda d: d["debe_configurar_2fa"] is True)

    print("== Los demás roles no cambian ==")
    for email in ("manager1@demo.com", "rrpp1@demo.com", "cliente@demo.com"):
        chk(f"{email} entra normal", login(email), 200, lambda d: "debe_configurar_2fa" not in d and "requiere_verificacion" not in d and d["token"])

    print("== Límite de inicios de sesión ==")
    codigos = []
    for _ in range(10):
        codigos.append(login("cliente@demo.com", "clave-mala")[0])
        if codigos[-1] == 429: break
    verdad(f"después de varios intentos seguidos desde la misma dirección se frena con 429 (intentos hasta frenar: {len(codigos)})", codigos[-1] == 429 and codigos.count(401) >= 1)
    chk("lo demás de la página sigue andando", pedir("GET", "/publico/boliches"), 200)
finally:
    servidor.terminate()
fin()
