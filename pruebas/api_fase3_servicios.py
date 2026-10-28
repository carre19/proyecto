"""Pruebas de la fase 3 que necesitan un servidor con otra configuración: el aviso de pago sin secreto configurado (503),
el límite de intentos de compra por dirección (429) y el reintento de los avisos cuando el servicio de WhatsApp falla.
Levanta su propio servidor en el puerto 3912 y un WhatsApp falso en el 3913. Hace falta PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE
(una base recién cargada, sin otro servidor usando esa misma base con las tareas automáticas encendidas: se pisarían los avisos);
el JWT_SECRET sale del .env del proyecto.
    python3 pruebas/api_fase3_servicios.py"""
import json, os, subprocess, sys, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

os.environ["API"] = "http://127.0.0.1:3912/api"
from comun import chk, entrar, fin, pedir, verdad

recibidos, fallos_restantes = [], [1]  # el WhatsApp falso falla la primera vez y después anda
class WhatsAppFalso(BaseHTTPRequestHandler):
    def do_POST(self):
        cuerpo = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if fallos_restantes[0] > 0:
            fallos_restantes[0] -= 1
            self.send_response(500); self.end_headers(); return
        recibidos.append(cuerpo); self.send_response(200); self.end_headers()
    def log_message(self, *a): pass
fake = HTTPServer(("127.0.0.1", 3913), WhatsAppFalso)
threading.Thread(target=fake.serve_forever, daemon=True).start()

raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
entorno = {**os.environ, "PORT": "3912", "DB_HOST": os.environ["PGHOST"], "DB_PORT": os.environ["PGPORT"], "DB_USER": os.environ["PGUSER"],
           "DB_PASSWORD": os.environ["PGPASSWORD"], "DB_NAME": os.environ["PGDATABASE"], "LIMITE_COMPRAS": "3",
           "WHATSAPP_API_URL": "http://127.0.0.1:3913/mensaje", "WHATSAPP_API_TOKEN": "t0ken", "FRONTEND_PUBLIC_URL": "https://boliches.ejemplo"}
entorno.pop("PAGOS_WEBHOOK_SECRET", None)
servidor = subprocess.Popen(["node", "src/index.js"], cwd=raiz, env=entorno, stdout=open("/tmp/claude-1000/srv_servicios.log", "w"), stderr=subprocess.STDOUT)
try:
    for _ in range(40):
        try: urllib.request.urlopen("http://127.0.0.1:3912/api/publico/boliches"); break
        except Exception: time.sleep(0.25)

    TA1, UA1 = entrar("admin1@demo.com")
    U = next(b["id_boliche"] for b in UA1["boliches"] if b["nombre"] == "Boliche Uno")
    pub = pedir("GET", "/publico/boliches/boliche-uno")[1]
    ev = next(e for e in pub["eventos"] if e["nombre"] == "Noche Electrónica")
    tanda = next(t for t in ev["entradas"] if t["nombre"] == "Tanda 2")["id_tipo_entrada"]
    compra = lambda dni, contacto: pedir("POST", f"/publico/boliches/boliche-uno/eventos/{ev['id_evento']}/comprar", {"items": [{"id_tipo_entrada": tanda, "nombre": "A", "apellido": "B", "dni": str(dni)}], **contacto})

    print("== Sin secreto configurado ==")
    chk("el aviso de pago responde 503 (la confirmación automática está apagada)", pedir("POST", "/pagos/webhook", {"referencia": "NXAAAAAA", "monto": 1, "id_operacion": "x"}), 503)

    print("== Reintento de avisos ==")
    c = chk("compra con teléfono", compra(60000001, {"contacto_telefono": "351 123 4567"}), 201)
    chk("el admin confirma el pago", pedir("PUT", f"/boliches/{U}/compras/{c['id_compra']}/pagar", None, TA1), 200)
    time.sleep(1.5)
    avisos = lambda: [a for a in pedir("GET", f"/boliches/{U}/notificaciones", None, TA1)[1] if a["id_compra"] == c["id_compra"]]
    a = avisos()[0]
    verdad("el primer intento falló: el aviso queda pendiente con el error registrado", a["estado"] == "pendiente" and a["intentos"] == 1 and "500" in (a["error"] or ""))
    for _ in range(25):
        time.sleep(1)
        if avisos()[0]["estado"] == "enviada": break
    verdad("al reintentar sale bien y queda enviada", avisos()[0]["estado"] == "enviada")
    verdad("el servicio recibió un solo mensaje, con el link de la compra y el número de destino", len(recibidos) == 1 and recibidos[0]["to"] == "351 123 4567" and f"https://boliches.ejemplo/compra/{c['token_publico']}" in recibidos[0]["message"])

    print("== Límite de compras por dirección ==")
    # ya se hizo 1 compra desde esta dirección; el límite es 3 por ventana
    chk("segunda compra", compra(60000002, {"contacto_email": "a@b.com"}), 201)
    chk("tercera compra", compra(60000003, {"contacto_email": "a@b.com"}), 201)
    chk("la cuarta se frena con 429", compra(60000004, {"contacto_email": "a@b.com"}), 429, lambda d: "intentos" in d["mensaje"])
    chk("lo demás de la página sigue andando", pedir("GET", "/publico/boliches"), 200)
finally:
    servidor.terminate()
    fake.shutdown()
fin()
