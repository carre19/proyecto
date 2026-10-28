# Despliegue en un VPS

Esta guía deja la plataforma funcionando en un servidor propio (VPS) con HTTPS, un subdominio por boliche, la base de datos y las
imágenes en volúmenes que sobreviven a las actualizaciones, y copias de seguridad diarias. Todavía no están definidos el **dominio** ni el
**proveedor del VPS** (ver sección 4 del README): donde dice `TU-DOMINIO.com` va el que se elija.

Todo corre con Docker: `db` (PostgreSQL 16), `back` (la API) y `front` (nginx con el front y el proxy a la API).

## 1. Qué hace falta

- Un VPS con Linux (por ejemplo Ubuntu 24.04), 2 GB de memoria y 20 GB de disco alcanzan para empezar. Puertos 80 y 443 abiertos.
- Docker y el plugin de Compose (`docker compose version`).
- Un dominio. Cada boliche vive en `boliche.TU-DOMINIO.com`; la plataforma (panel, login, lista de boliches) en `TU-DOMINIO.com`.

## 2. DNS

En el panel del dominio, dos registros `A` que apunten a la IP del VPS:

| Nombre | Tipo | Valor |
|---|---|---|
| `@` (el dominio solo) | A | IP del VPS |
| `*` (comodín: todos los subdominios) | A | IP del VPS |

## 3. Certificado HTTPS de comodín

Los subdominios de los boliches necesitan un certificado que valga para `*.TU-DOMINIO.com` y para `TU-DOMINIO.com`. Los certificados de
comodín solo se pueden pedir con el desafío por DNS. Con certbot:

```bash
sudo apt install certbot
sudo certbot certonly --manual --preferred-challenges dns -d TU-DOMINIO.com -d "*.TU-DOMINIO.com"
```

Certbot pide crear un registro `TXT` en el DNS y después guarda los archivos en `/etc/letsencrypt/live/TU-DOMINIO.com/`. Copiá
`fullchain.pem` y `privkey.pem` a una carpeta fija, por ejemplo `/etc/plataforma/certs/`. (Si el proveedor del dominio tiene un
complemento de certbot para su DNS, la renovación se automatiza; si no, hay que repetir el paso cada 90 días.)

## 4. Instalar

```bash
git clone https://github.com/carre19/proyecto.git /opt/plataforma && cd /opt/plataforma
cp deploy/.env.prod.example .env
nano .env        # completar TODO: dominio, carpeta de certificados y las claves
```

Para generar cada clave (`DB_PASSWORD`, `JWT_SECRET`, `TOTP_CLAVE`, `PAGOS_WEBHOOK_SECRET`):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Guardá `TOTP_CLAVE` en un lugar aparte: si se pierde, todos los admins tienen que volver a activar la verificación en dos pasos.

## 5. Levantar

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build
docker compose -f deploy/docker-compose.prod.yml --env-file .env ps       # los tres servicios en "running"
```

La primera vez, Postgres crea la base con el esquema (`database/00_schema*.sql`). **No** se cargan los datos de ejemplo.

## 6. Crear el superadmin

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file .env exec back \
  node scripts/crear_superadmin.js email@dominio.com "una contraseña larga" Nombre Apellido
```

Al entrar por primera vez en `https://TU-DOMINIO.com/login`, el sistema obliga a activar la verificación en dos pasos (con una app como
Google Authenticator) y entrega códigos de recuperación: guardalos. Después, desde **Boliches**, el superadmin crea cada boliche junto con
su admin; ese boliche queda disponible en `https://subdominio.TU-DOMINIO.com`.

## 7. Confirmación automática de pagos y avisos

- **Transferencias:** el servicio que detecte que llegó el dinero (pendiente de elegir) tiene que llamar a
  `POST https://TU-DOMINIO.com/api/pagos/webhook` con `{referencia, monto, id_operacion}` y la cabecera `X-Firma` = HMAC-SHA256 en hexa
  del cuerpo con `PAGOS_WEBHOOK_SECRET`. Sin ese secreto el aviso está apagado y los pagos se confirman a mano desde el panel.
- **WhatsApp y email:** `WHATSAPP_API_URL` / `EMAIL_API_URL` reciben un `POST` con JSON (`{to, message}` y `{to, subject, text}`, con
  `Authorization: Bearer <token>` si se define el token). Sin ellos los avisos quedan registrados como "simulados" y no sale ningún mensaje.

## 8. Copias de seguridad

```bash
crontab -e
0 4 * * * cd /opt/plataforma && ./deploy/backup.sh >> /var/log/plataforma-backup.log 2>&1
```

Guarda la base y las imágenes en `backups/` (los últimos 14 días). Copiá esa carpeta también **fuera del servidor**. Para restaurar la base:

```bash
gunzip -c backups/base_FECHA.sql.gz | docker compose -f deploy/docker-compose.prod.yml --env-file .env exec -T db psql -U plataforma -d plataforma
```

## 9. Actualizar a una versión nueva

```bash
cd /opt/plataforma && git pull
# Si hay archivos nuevos database/00_schema_faseN.sql, aplicarlos (se pueden repetir sin problema):
for f in $(LC_ALL=C ls database/00_schema_fase*.sql); do
  docker compose -f deploy/docker-compose.prod.yml --env-file .env exec -T db psql -U plataforma -d plataforma < "$f"
done
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build
```

## 10. Cosas a tener en cuenta

- **Una sola copia del back:** las tareas periódicas (avisos, vencimiento de compras y borrado de datos a los 3 meses) corren dentro del back.
  Si algún día se corren varias copias, dejá `TAREAS_AUTO=false` en todas menos una.
- **Sesiones por subdominio:** el navegador guarda la sesión por dirección, así que un cliente que compra en un boliche inicia sesión por
  separado en cada subdominio. El personal usa siempre `https://TU-DOMINIO.com`.
- **Datos personales:** nombre, DNI y contacto se borran a los 3 meses sin compras ni actividad (`RETENCION_MESES`, `RETENCION_CUENTAS`).
  El borrado también se puede ejecutar a mano desde **Plataforma** (superadmin).
- **Seguridad:** `VERIFICACION_ADMIN=obligatoria` ya está en el compose de producción. Cambiar contraseñas de la base por claves largas y
  no abrir el puerto 5432 al exterior (en producción no se publica).
