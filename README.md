# Proyecto — Plataforma para boliches y bares

Fuente de esta documentación: la página de Notion **"Proyecto nuestro"** (6 de octubre de 2026, @Gianluca). Todo lo que figura en la sección 1 es lo que dice esa página; lo que decidimos nosotros al implementarlo está en la sección 2 y lo que sigue sin definir, en la sección 4.

- **Estado actual:** **todas las fases están hechas** (1 a 6): los 5 roles, boliches funcionales, venta de entradas con QR, pagos, RRPP, personal y finanzas, y la parte de la plataforma (descuentos, verificación en dos pasos, borrado de datos, cobros y despliegue). Están **probadas con 852 comprobaciones automáticas** y vistas en un navegador real. Lo que sigue pendiente son definiciones del equipo (dominio, servicios de pago y de mensajes: ver sección 4) y ajustes menores (6.2). El front **conserva su estilo actual**.
- **Rama:** todo el trabajo está en `main` (no hay otras ramas).
- **Base de datos:** PostgreSQL local administrada con pgAdmin 4 (ver "Puesta en marcha").
- **Tecnología:** React + Vite en el front; Node.js + Express + PostgreSQL en el back; un VPS para correr todo.

---

# 1. Documentación funcional

## 1.1 Idea general

El proyecto es un sistema que controla varias páginas de boliches y bares desde una sola plataforma. Cada local tiene su propia página, pero todos se administran desde el mismo lugar.

## 1.2 Roles y paneles

El sistema tiene 5 roles y cada uno tiene su propio panel: 5 paneles en total.

| Rol y panel | Quién es | Qué controla |
|---|---|---|
| **Superadmin** | El programador | Todo, en todos los paneles y en todos los locales |
| **Admin de boliche** | El o los dueños de uno o varios locales | Sus locales: precios, entradas, capacidad, personal, equipo de RRPP y su comisión, páginas, redes, proveedores, gastos e ingresos |
| **RRPP manager** | Coordina al equipo de RRPP (el admin puede tenerlo o no) | Su equipo de RRPP: altas, asignaciones, supervisión y resultados de ventas |
| **RRPP** | Trabaja para un local | Sus listas de invitados y la venta de entradas con comisión |
| **Usuario / cliente** | El público | Ve eventos y consigue entrada |

### Jerarquía y visibilidad

Son 5 niveles. Cada nivel ve los números de lo que tiene por debajo: el manager ve lo que trae cada RRPP y el admin lo de su local. *(La página de Notion lo muestra con un gráfico embebido que no se puede leer desde afuera; lo de arriba es el texto que lo acompaña.)*

### Varios locales

Cada local tiene que ver únicamente sus propios datos; solo el superadmin ve todos los locales a la vez.

- El admin de boliche, el RRPP manager y los RRPP ven solo lo de su boliche.
- Esa separación conviene resolverla desde el diseño de la base de datos, porque cambiarla después cuesta mucho.

## 1.3 Qué maneja el admin de boliche

Un admin puede tener varios locales y maneja cada uno por separado.

- **Precios:** fija el precio de entrada virtual y el de puerta, en uno o en varios de sus locales.
- **Entradas y capacidad:** define las entradas y la capacidad de cada local.
- **Eventos:** crea los eventos de cada noche.
- **Equipo:** decide si tiene un RRPP manager o no, y define a sus RRPP.
- **Comisión:** establece la comisión de los RRPP.
- **Descuentos:** define los descuentos para los clientes con cuenta.
- **Personal:** se encarga del personal externo del local (seguridad, limpieza, barman y demás), lleva la ficha de cada persona y define cuánta gente de seguridad, limpieza y barman va a cada evento.
- **Páginas:** accede a la página de cada boliche desde el apartado de ese boliche.
- **Redes:** ve las cuentas de Instagram y WhatsApp de sus locales.
- **Finanzas:** lleva el apartado de proveedores, gastos e ingresos.

### Pantalla principal del admin

Al entrar a su panel, el admin ve primero sus boliches o lugares. Bajando, ve:

- Ingresos y gastos.
- El ranking de ventas por RRPP.

## 1.4 RRPP manager y RRPP

El RRPP manager gestiona al equipo de RRPP, y los RRPP arman listas y venden entradas.

**El RRPP manager puede:**

- Dar de alta RRPP.
- Asignar y desasignar RRPP.
- Supervisarlos.
- Ver los resultados de ventas y cuántas entradas se asignó a cada RRPP.
- Crear los eventos de cada noche.

**El RRPP puede:**

- Armar listas de invitados.
- Vender entradas con comisión.
- Controlar el QR de las entradas en la puerta.

La comisión la establece el admin.

Cada RRPP tiene su propio **talonario** de entradas a mano. El talonario tiene un link propio, conectado con el banco del admin o con la cuenta que el admin prefiera. Con ese link se muestra y se adjudica la venta al RRPP.

**Cada invitado de una lista lleva estos datos:** nombre y apellido, DNI, teléfono y edad.

### Pantalla principal del RRPP

- Sus ventas y su comisión ganada.
- Las entradas que le asignaron.
- Sus listas de invitados.
- El ranking de RRPP.

### Pantalla principal del RRPP manager

- Los resultados de ventas de cada RRPP.
- Las entradas asignadas a cada RRPP.
- El ranking de RRPP.
- Los eventos que creó.

## 1.5 Página del boliche para el cliente

Al entrar a la página de un boliche, el cliente ve:

- Los próximos eventos.
- Los precios y las tandas de entradas.
- Las fotos y la ubicación del boliche.
- Sus entradas compradas, con el QR.

## 1.6 Pantalla principal del superadmin

- La lista de todos los boliches.
- Las mensualidades y los cobros pendientes.
- Lo que gana la plataforma por entradas.
- Los admins y usuarios del sistema.

## 1.7 Pago de entradas

El cliente puede pagar desde la página por transferencia, desde cualquier plataforma. Si no paga ahí, le aparece el precio de puerta.

Cada entrada puede tener dos precios:

- **Virtual:** el que se paga desde la página.
- **Puerta:** el que se paga en el local.

Reglas:

- El pago se confirma automáticamente cuando llega el dinero.
- Cuando se confirma el pago, el cliente recibe un QR y un aviso por WhatsApp, y también por Gmail si lo necesita.
- En puerta se puede pagar por QR, en efectivo o por transferencia.
- Una entrada ya pagada no se devuelve.
- La entrada es personal: el cliente no puede pasársela a otra persona.
- Para comprar una entrada, la página pide nombre, apellido y DNI.
- Se pueden comprar varias entradas en una misma compra, cargando el nombre y el DNI de cada persona.

## 1.8 Cuenta del cliente

El cliente puede crear una cuenta si quiere; no es obligatoria. Con esa cuenta puede recibir los descuentos que el admin quiera definir.

Ejemplo: un cliente registrado hace más de 6 meses recibe un 5 % de descuento al pagar por transferencia.

## 1.9 Personal externo

Son roles de personal externo: **no tienen panel propio** y el admin se encarga de gestionarlos.

| Rol | Qué hace |
|---|---|
| Encargado o gerente | Maneja la noche en el local y responde al admin |
| Puerta y control de acceso | Controla el ingreso: entradas, listas y QR |
| Boletería y caja | Cobra y vende entradas en el local |
| Seguridad | Cuida el orden y el ingreso |
| Barman | Atiende la barra |
| Limpieza | Mantiene el local |
| DJ y artistas | Quienes tocan en cada evento |
| Guardarropa | Recibe y devuelve abrigos y pertenencias |
| Mozos y sector VIP | Atienden mesas y reservas |

### Gestión del personal externo

El admin lleva una ficha por persona, para gestionar a quienes trabajan con su local y tener a mano su contacto. Las fichas se van completando con el tiempo.

Para cada evento, el admin define cuánta gente de seguridad, limpieza y barman va.

La ficha tiene: nombre y apellido; rol (qué hace en el local); contacto (los métodos que el admin va agregando); cuándo estuvo (en qué fechas o eventos trabajó); cuánto cobra; y otros datos que el admin quiera sumar.

## 1.10 Proveedores, gastos e ingresos

El admin tiene un apartado para llevar los proveedores, los gastos y los ingresos de sus locales.

- **Proveedores:** se registran todos sus gastos y suministros.
- **Gastos:** lo que gasta el local.
- **Ingresos:** lo que entra al local.

Se ven en tres niveles: de cada noche o evento, el general de cada club, y el general de cada admin con todos sus locales juntos.

## 1.11 Datos de un evento

Fecha y hora, artistas, edad mínima, dress code, y mesas y sector VIP si hay.

## 1.12 Tipos de entrada

- **Por tandas:** se vende en varias tandas, cada una a un precio distinto.
- **VIP:** una entrada aparte para el sector VIP.

## 1.13 Cobro de la plataforma

El superadmin crea cada boliche nuevo. La plataforma cobra de dos formas:

- **Por boliche:** un monto razonable por mes por tener el boliche instalado.
- **Por entrada:** el 6 % de cada entrada, que paga el cliente.

Si es un solo evento, se cobra otro monto y no hay mensualidad.

## 1.14 Seguridad de los datos

- El DNI de los clientes lo ven el admin, el RRPP manager y los RRPP.
- Los datos de cada cliente se guardan hasta 3 meses después de la última vez que compró una entrada o interactuó con el sistema.
- Cada QR sirve una sola vez: si se escanea de nuevo, se rechaza porque ya fue usado.
- La entrada lleva escrito el número de DNI de la persona. Como último recurso, si alguien tiene que irse y volver, puede presentar su entrada con el DNI escrito junto con su DNI físico.
- Admins, RRPP y clientes inician sesión con email y contraseña. Los admins tienen además una verificación extra.
- De los pagos, el RRPP puede ver cuánto vendió, su comisión y el nombre de quien pagó. El RRPP manager ve lo mismo que cada RRPP, de todo su equipo.

## 1.15 Diseño

- **Tipografía:** solo Space Grotesk, en todo el sistema.
- **Estilo visual:** solo glassmorphism.

> **Estado:** por indicación del equipo, **el estilo del front se deja como está**: se mantienen su tipografía (Cinzel + Philosopher), el mármol del modo claro, el modo oscuro de Ares y su estructura visual. Aplicar Space Grotesk + glassmorphism queda como pendiente, para cuando el equipo lo pida.

## 1.16 Tecnología

El sistema se hace con React y Vite, y va a necesitar un VPS para correr.

- Frontend: React con Vite.
- Servidor: un VPS.
- Cada boliche tiene su página en un subdominio de la plataforma.

---

# 2. Decisiones técnicas que tomamos al implementar

Estas decisiones no están en la página de Notion: las tomamos para poder avanzar y se pueden cambiar.

| Tema | Decisión | Por qué |
|---|---|---|
| Backend y base | Node.js + Express + PostgreSQL (el que ya usamos), administrado con pgAdmin 4 | Es lo que está pendiente en Notion y ya está andando |
| Separación por local | Toda tabla de un local lleva `id_boliche`, y el acceso lo decide un único middleware que mira el rol y los boliches de la persona | Pide Notion: resolverlo desde el diseño, no con filtros sueltos |
| Roles | Un único campo `rol` en el usuario, con los 5 valores del documento | Un usuario tiene un solo rol; lo que cambia es a qué boliches accede |
| Quién accede a qué local | Admin: tabla `boliche_admin` (puede tener varios). Manager y RRPP: tabla `boliche_equipo` (un local). Superadmin: todos. Cliente: ninguno (solo ve lo público) | El admin tiene varios locales; manager y RRPP uno |
| Subdominio | Cada boliche guarda su `subdominio` único. Mientras no haya dominio, la página pública se ve en `/b/:subdominio` | El dominio sigue sin definir |
| Contraseñas | bcrypt; el login pide email y contraseña | Lo que dice Notion; la verificación extra de admins llega en una fase posterior |
| Diseño | **Se conserva el estilo actual del front.** El front se adapta a la plataforma (paneles, pantallas y menús por rol) reutilizando sus componentes y su estilo; Space Grotesk + glassmorphism (Notion) queda pendiente | Indicación del equipo: dejar el estilo igual |
| Convivencia con lo anterior | El sistema anterior (gestor de una organizadora) **se reemplaza** en esta rama: base, API y pantallas son las de la plataforma. La rama `main` conserva el sistema anterior completo | Indicación del equipo: cambiar todo salvo el estilo; y poder volver atrás |

## 2.1 Decisiones de la fase 1B

- **Bebidas:** la tabla se llama `bebida` (el equipo pidió "una tabla bebidas"; en el documento figuraba como `producto`). Cada bebida tiene categoría, nombre, descripción, precio, imagen y un interruptor "disponible" para sacarla de la carta sin borrarla. No se repite el mismo nombre en la misma categoría de un boliche (sin importar mayúsculas), pero otro boliche sí puede tener la suya.
- **Fotos del boliche:** tabla `boliche_foto`, hasta **10** por boliche y **una sola portada** (la primera que se sube; se puede cambiar). Reemplaza al arreglo `boliche.fotos`.
- **Entradas:** la suma de los cupos de un evento **no puede superar la capacidad del boliche**; sin capacidad cargada no se pueden crear entradas, y no se puede bajar la capacidad por debajo de lo ya repartido. Lo garantiza la base con triggers. La página pública muestra precios y estado, nunca el cupo.
- **Mesas VIP:** catálogo por boliche (`mesa_vip`) y, por evento, cuáles se ofrecen y si están `disponible` o `reservada` (`evento_mesa_vip`). La reserva por el cliente llega en la fase 2.
- **Colores del boliche:** 4 por modo (fondo, tarjetas, texto, acento) en `#RRGGBB`, por defecto negro y dorado. El back exige legibilidad: texto/fondo y texto/tarjetas con contraste ≥ 4,5:1 y acento/fondo ≥ 3:1. Solo se cambian colores: la tipografía y la estructura no.
- **Permisos:** superadmin y admin editan todo lo del boliche; manager y RRPP solo lo ven (por la API); el cliente ve la página pública.
- **Precios** en pesos enteros (sin centavos). **Tipografía** de la sección del boliche: por ahora la misma de la app (Cinzel + Philosopher), pendiente de confirmar.
- **Robustez:** el pool de conexiones ya no tira el servidor si Postgres corta una conexión inactiva (antes la API se caía).

## 2.2 Decisiones de las fases 2 a 6

Como en las anteriores, no están en Notion: las tomamos para avanzar y se pueden cambiar.

**Entradas y compra (fase 2)**
- La compra queda **pendiente 30 minutos** (`MINUTOS_RESERVA`); si no se paga, se cancela sola y el cupo se libera. Mientras tanto la entrada reserva su lugar.
- **Una persona (DNI) no puede tener dos entradas vigentes para el mismo evento** (la entrada es personal). Hasta 10 entradas por compra.
- El **cupo** de cada tipo se controla en la base y con bloqueo de filas (dos compras a la vez no se pasan). Una entrada se marca **agotada sola** al venderse todo y vuelve a estar disponible si se libera cupo; si el admin la marca agotada a mano, no se toca.
- Para avisar el pago hace falta **teléfono o email** del comprador (así se resuelve el pendiente de cómo conseguirlo). Se puede comprar **sin cuenta**: se ve la compra con un link (`/compra/:token`).
- El **DNI** lo ven solo el admin, el manager y el RRPP; el superadmin ve el DNI enmascarado (como pide la documentación).
- Una compra pagada **no se devuelve**. Una entrada de otro boliche se trata en la puerta como si no existiera.

**Pagos (fase 3)**
- El cliente transfiere a la **cuenta de cobro** que cargó el admin, con un **código de referencia** (`NX…`). Sin cuenta cargada, ese boliche vende solo en la puerta.
- La confirmación automática la hace un **aviso firmado** (`POST /api/pagos/webhook`, HMAC-SHA256): el servicio que detecte la transferencia es el pendiente de la sección 4. Si llega menos plata, de más, tarde o repetida, el pago queda **"a revisar"** para el admin (que puede reactivar una compra vencida si todavía hay lugar).
- Los avisos (WhatsApp y email) van por una **cola** que se envía aparte, con reintentos; sin servicio conectado quedan "simulados".
- El **6 %** de la plataforma lo paga el cliente sobre las compras de la página (no en la puerta) y no es ingreso ni gasto del local.

**RRPP (fase 4)**
- Un **talonario** es por RRPP y por evento: cantidad asignada + **link propio** (`/t/CODIGO`). Las compras hechas con ese link se le adjudican y cuentan contra lo asignado (las reservas sin pagar también). Entre todos los talonarios no se pueden asignar más entradas que el total del evento.
- La **comisión** se fija al cobrar con el porcentaje que el RRPP tenía en ese momento (cambiarla después no altera ventas anteriores). Las ventas en la puerta de un RRPP también son suyas.
- Cada invitado de una lista debe tener la **edad mínima del evento**; un DNI figura una sola vez en las listas de un evento.

**Personal, proveedores y finanzas (fase 5)**
- Solo el admin (y el superadmin) los gestionan. Una persona o un proveedor **con historial no se borra**: se desactiva.
- Resumen = entradas pagadas + ingresos cargados − gastos cargados − pagos al personal − comisiones de RRPP. Tres niveles: la noche, el boliche y el admin con todos sus locales.

**Plataforma (fase 6)**
- **Descuentos:** el cliente con cuenta de más de N meses recibe el **mayor** descuento que le corresponda (no se acumulan), solo en compras de la página.
- **Verificación en dos pasos** (TOTP, apps como Google Authenticator) para admins y superadmin, con códigos de recuperación. Con `VERIFICACION_ADMIN=obligatoria` el admin sin activarla solo puede usar la pantalla Seguridad; por defecto es opcional (cómodo para desarrollar). El superadmin puede restablecérsela a un admin.
- **Borrado de datos a los 3 meses** (nombre, DNI y contacto; lo económico se conserva): cuenta desde la última compra o el evento, lo que sea más tarde. **Vale también para las cuentas de clientes** (resuelve el pendiente; se apaga con `RETENCION_CUENTAS=false`). Corre una vez por día.
- **Cobros:** `monto_mensual` del boliche es la mensualidad, o el monto por evento si el boliche es de un solo evento. El superadmin genera los cobros de cada mes (sin duplicar) y los marca pagados.
- Cada boliche se ve en su **subdominio** si se define `VITE_DOMINIO_BASE`; mientras no haya dominio, en `/b/:subdominio`.

---

# 3. Plan de trabajo

| Fase | Contenido | Estado |
|---|---|---|
| **0** | Documentación en este README, copia del proyecto con PostgreSQL local | ✅ Hecha |
| **1** | Esquema multi-boliche; los 5 roles con su login; **panel del superadmin** (boliches y sus admins, usuarios); **panel del admin** (sus boliches, equipo y eventos de cada noche); **panel del manager** (su equipo y eventos); **página pública del boliche**; pruebas de que cada local ve únicamente lo suyo. Todo con el estilo actual del front | ✅ Terminada: base de datos, API y front, probados |
| **1B** | Boliches funcionales: ficha del local (descripción, ubicación, capacidad, fotos con portada), **entradas por evento** (tandas y VIP con precio virtual y de puerta, cupo y estado), **carta de bebidas**, **mesas VIP**, **colores propios** del boliche (claro y oscuro) y página pública completa | ✅ Terminada: base de datos y API (291 checks) y front probado en navegador; ajustes menores en 6.1B |
| **2** | Entradas: tandas, VIP, precios virtual y de puerta, capacidad; compra con nombre, apellido y DNI; QR de un solo uso y control en puerta | ✅ Hecha: compra con cupos, QR, venta en puerta y control de acceso (ver 6.1C) |
| **3** | Pagos: confirmación automática de la transferencia, avisos por WhatsApp y Gmail, comisión de la plataforma (6 %) | ✅ Hecha con conexiones por configuración: falta elegir el servicio que detecta la transferencia y los de mensajes (ver 6.1D y sección 4) |
| **4** | RRPP: alta y asignación, talonarios con link propio, listas de invitados, comisión, rankings y resultados | ✅ Hecha (ver 6.1E) |
| **5** | Personal externo (fichas y dotación por evento), proveedores, gastos e ingresos en sus tres niveles | ✅ Hecha (ver 6.1F) |
| **6** | Cuenta del cliente y descuentos, verificación extra del admin, borrado de datos a los 3 meses, cobros y mensualidades del superadmin, despliegue en el VPS | ✅ Hecha: falta elegir proveedor del VPS y dominio (ver 6.1G y `docs/DESPLIEGUE.md`) |

---

# 4. Pendientes por definir

Lo que figura en Notion como sin resolver, y cómo quedó resuelto por ahora (se puede cambiar).

- [ ] **Los montos:** la mensualidad por boliche y el monto de un evento único son configurables por boliche (los carga el superadmin); falta que el equipo defina los valores.
- [ ] **El dominio** de la plataforma: el front y los archivos de despliegue ya soportan un subdominio por boliche (`VITE_DOMINIO_BASE`, ver `docs/DESPLIEGUE.md`); falta elegir el dominio y el proveedor del VPS.
- [x] **Cómo funciona el link del talonario:** es un link `/t/CODIGO` que lleva a la página del boliche con el vendedor adjudicado; el cliente paga por transferencia a la cuenta que cargó el admin. Si el equipo quiere que el link vaya impreso en las entradas a mano o conectado a otro banco, se ajusta (ver sección 2.2).
- [ ] **Con qué servicio se detecta la transferencia:** el sistema recibe el aviso por un webhook firmado; falta elegir el servicio (banco, Mercado Pago, etc.) y conectarlo. Mientras tanto el admin confirma a mano.
- [x] **Cómo se obtiene el teléfono o el email del cliente:** se piden al comprar (al menos uno).
- [x] **Si la regla de los 3 meses vale para clientes con cuenta:** por ahora sí (se puede apagar con `RETENCION_CUENTAS=false`).
- [x] Qué backend y base de datos usar: **Node.js + PostgreSQL**.
- [ ] **Servicios de mensajes:** WhatsApp y email se conectan por HTTP (`WHATSAPP_API_URL`, `EMAIL_API_URL`); falta elegir los proveedores.
- [ ] **Space Grotesk + glassmorphism** (Notion): el estilo del front se conserva a pedido del equipo.

---

# 5. Puesta en marcha

## Base de datos con pgAdmin 4

La base es un PostgreSQL local (versión 12 o superior) que se maneja desde pgAdmin 4.

1. **Conexión.** En pgAdmin: *Servers → tu servidor* (host `localhost`, puerto `5432`, usuario `postgres`). Esos mismos datos van en el `.env`.
2. **Archivo `.env`.** Copiar `.env.example` como `.env` y completar `DB_PASSWORD`. **No borrar las demás líneas** (sobre todo `JWT_SECRET`). El `.env` no se sube a GitHub.
3. **Crear y cargar la base**, de cualquiera de estas dos formas:
   - **Con el script:** `./database/cargar_base.sh` crea la base y carga el esquema y los datos de prueba. Con `--reset` la borra y la vuelve a crear.
   - **A mano en pgAdmin:** clic derecho en *Databases → Create → Database…*; luego *Query Tool* sobre esa base y ejecutar, en orden, `database/00_schema.sql`, cada `database/00_schema_faseN.sql` (fases 2 a 6) y `database/01_datos_prueba.sql`.
   - **Si ya tenés la base de una fase anterior:** `./database/cargar_base.sh --migrar` le aplica las fases nuevas sin tocar tus datos (los archivos `00_schema_faseN.sql` se pueden repetir sin problema). Después reiniciá el back.
4. **Levantar la app:** `npm install && npm run dev` (back en http://localhost:3000) y, en otra terminal, `cd frontend && npm install && npm run dev` (front en http://localhost:5173).

| Variable | Descripción | Ejemplo |
|---|---|---|
| `PORT` | Puerto del back | `3000` |
| `DB_HOST` / `DB_PORT` | Host y puerto de Postgres | `localhost` / `5432` |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Credenciales de la base | `postgres` / tu clave / `Proyecto` |
| `DB_SSL` | `true` solo si la base exige SSL | `false` |
| `JWT_SECRET` | Secreto para firmar las sesiones (obligatorio: sin él el servidor no arranca) | texto largo y aleatorio |
| `JWT_EXPIRES_IN` | Duración de la sesión | `8h` |
| `FRONTEND_URL` | Origen permitido por CORS | `http://localhost:5173` |
| `FRONTEND_PUBLIC_URL` | Dirección pública del front, para los links de los avisos (por defecto `FRONTEND_URL`) | `https://mi-dominio.com` |
| `PORCENTAJE_PLATAFORMA` / `MINUTOS_RESERVA` | Cargo de la plataforma (%) y minutos para pagar | `6` / `30` |
| `PAGOS_WEBHOOK_SECRET` | Secreto con el que se firma el aviso de pago (sin él, la confirmación automática está apagada) | texto largo |
| `WHATSAPP_API_URL` / `EMAIL_API_URL` (+ `_TOKEN`) | Servicios para los avisos al cliente (sin ellos, quedan "simulados") | |
| `VERIFICACION_ADMIN` | `obligatoria` para que los admins deban activar la verificación en dos pasos | `opcional` |
| `TOTP_CLAVE` | Clave que cifra los secretos de la verificación en dos pasos (por defecto deriva de `JWT_SECRET`) | texto largo |
| `RETENCION_MESES` / `RETENCION_CUENTAS` | Meses para borrar datos personales y si también se borran cuentas de clientes | `3` / `true` |
| `LIMITE_COMPRAS` / `LIMITE_LOGIN` | Intentos por dirección cada 10 minutos | `30` / `30` |
| `TRUST_PROXY` | `1` si el back corre detrás de nginx (para ver la IP real) | |
| `TAREAS_AUTO` | `false` para apagar las tareas periódicas en una copia del back | `true` |
| `VITE_DOMINIO_BASE` | (al construir el front) dominio de la plataforma para los subdominios de los boliches | `mi-dominio.com` |

## Cuentas de prueba

Los datos de prueba (`database/01_datos_prueba.sql`) traen una cuenta de cada rol, todas con la contraseña **`demo12345`** (solo para desarrollo):

| Email | Rol | A qué accede |
|---|---|---|
| `superadmin@demo.com` | Superadmin | Todos los boliches |
| `admin1@demo.com` | Admin | Boliche Uno y Bar Dos |
| `admin2@demo.com` | Admin | Club Tres |
| `manager1@demo.com` | RRPP manager | Boliche Uno |
| `rrpp1@demo.com`, `rrpp2@demo.com` | RRPP | Boliche Uno |
| `cliente@demo.com` | Cliente | Solo lo público (y sus compras en `/mis-entradas`) |

Los datos de prueba incluyen además un talonario de ejemplo para RRPP 1 (link `/t/DEMORRPP1`), una lista de invitados, personal, proveedores, gastos e ingresos de Boliche Uno, y la cuenta de cobro de Boliche Uno y Bar Dos.

Para crear un superadmin real (sin los datos de prueba): `npm run crear-superadmin -- email@dominio.com "una contraseña" Nombre Apellido`.

## Pruebas automáticas

Cada archivo de `pruebas/` corre contra una base **recién cargada** y con el back levantado (crean y borran datos). `npm run prueba-api`, `prueba-imagenes`, `prueba-fase1b`, `prueba-fase2` … `prueba-fase6`, y `prueba-fase3-servicios` / `prueba-fase6-servicios` (levantan su propio servidor con otra configuración). Para el back de pruebas: `PAGOS_WEBHOOK_SECRET=secreto-de-prueba LIMITE_COMPRAS=100000 LIMITE_LOGIN=100000 TAREAS_AUTO=false`. Las comprobaciones que envejecen fechas usan `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`. Hoy: **852 comprobaciones, todas OK**.

## Despliegue

Con Docker: `docker compose up -d --build` levanta una demostración (base con datos de ejemplo, back y front). Para un VPS en producción (HTTPS, subdominios, copias de seguridad): ver **[docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)** y la carpeta `deploy/`.

---

# 6. Estado de avance

Se actualiza con cada cambio importante. Última actualización: fases 1 a 6 terminadas (base de datos, API y front), con 852 comprobaciones automáticas.

## 6.1 Lo que está hecho

**Base de datos** (`database/00_schema.sql`)
- Tablas: `usuario` (5 roles), `boliche`, `boliche_admin` (un admin puede tener varios boliches), `boliche_equipo` (manager y RRPP, cada uno en un solo boliche, con comisión) y `evento`.
- La separación por local está resuelta **desde la base**, como pide Notion: claves compuestas y triggers hacen que el manager de un RRPP sea del mismo boliche, que el rol del equipo coincida con el del usuario, que solo un admin administre un boliche y que solo gente del boliche cree sus eventos. Se probaron a mano 14 casos incorrectos y la base rechazó todos.

**API** (`src/`)
- Registro de clientes y login para los 5 roles; el panel de cada uno (sus boliches) se arma desde la base, no desde el token, así desactivar una cuenta o cambiarle el rol vale al instante.
- **Un único middleware** (`accesoBoliche`) decide a qué boliche entra cada persona. Quien no es del boliche recibe 404; un boliche desactivado solo lo ve el superadmin.
- Superadmin: crea boliches con su admin, suma y quita admins (nunca queda un boliche sin admin), desactiva boliches y cuentas, lista usuarios.
- Admin: edita los datos de su local (no el subdominio, el cobro ni el estado), arma su equipo, fija la comisión de cada RRPP y crea eventos.
- Manager: da de alta RRPP, los asigna y desasigna, y crea y edita sus eventos (no los de otros).
- RRPP y cliente: ven lo suyo; el cliente solo la parte pública.
- Parte pública: boliches activos y sus próximos eventos, sin ningún dato interno (cobro, equipo, etc.).
- **82 pruebas de punta a punta** (`pruebas/api_plataforma.py`), incluidas las de aislamiento entre boliches y de permisos de cada rol. Todas pasan.

**Front** (`frontend/`, con el estilo de siempre: tipografía griega, mármol y modo oscuro de Ares)
- Landing de la plataforma, login y registro de clientes (nombre, apellido, DNI y teléfono opcionales).
- **Menú y pantalla de inicio según el rol:** superadmin y admin a sus boliches, manager y RRPP directo a su boliche, cliente a la lista pública.
- **Panel del superadmin:** boliches (crea cada uno junto con su admin), usuarios (alta de admins, activar y desactivar cuentas) y los admins de cada boliche.
- **Panel del admin:** sus boliches, y en cada uno los eventos, el equipo de RRPP (alta, comisión y manager) y los datos del local con las redes.
- **Panel del manager:** su boliche con los eventos que crea y el equipo que asigna; **panel del RRPP:** su boliche en modo consulta.
- **Parte pública:** `/explorar` con los boliches activos y `/b/:subdominio` con datos, ubicación, redes y próximos eventos.
- Los bloques que llegan en otras fases (ingresos y gastos, ranking de RRPP, cobros, entradas) aparecen marcados como "disponible en la fase N".
- Se quitaron las pantallas del sistema anterior. Probado en un navegador real con las cuentas demo, en los dos modos de color y en celular: alta de un evento y de un RRPP desde la pantalla, registro de un cliente y las vistas de cada rol.

## 6.1B Fase 1B (boliches funcionales)

**Hecho y probado**
- **Base de datos:** tablas `boliche_foto`, `tipo_entrada`, `bebida`, `mesa_vip`, `evento_mesa_vip` y `boliche_tema`; `evento.imagen`; triggers de máximo 10 fotos y de cupos contra capacidad. Datos de prueba con entradas, bebidas y mesas. Migración `database/migraciones/fase_1b.sql` (idempotente, probada dos veces sobre una base de la fase 1: pasa las fotos viejas a `boliche_foto`).
- **API:** fotos con portada, entradas por evento, bebidas con imagen, mesas VIP con imagen y las que ofrece cada evento, colores del boliche, y la página pública con todo junto (ver 7.1). Imágenes de eventos (flyer).
- **Pruebas: 291 checks, todos OK** — `pruebas/api_plataforma.py` (82), `pruebas/api_imagenes.py` (42) y `pruebas/api_fase1b.py` (167: aislamiento entre boliches, permisos por rol, cupos vs. capacidad, nombres únicos, contraste de colores, archivos falsos, qué muestra el público).
- **Front del panel** (`frontend/src/components/boliche/`): la ficha del boliche ahora tiene las pestañas **Eventos, Entradas, Bebidas, Mesas VIP, Diseño, Equipo y Datos del local**.
  - **Entradas:** se elige el evento y se cargan tandas y VIP (precio online y de puerta, cupo, estado); muestra cuántos cupos se repartieron de la capacidad del boliche, y avisa si falta cargar la capacidad.
  - **Bebidas:** alta, edición y baja de cada bebida con su foto; "fuera de la carta" la oculta del público sin borrarla.
  - **Mesas VIP:** catálogo con fotos y, por evento, qué mesas ofrece y si están disponibles o reservadas.
  - **Diseño:** editor de los 4 colores en modo oscuro y claro, con vista previa en vivo, aviso de contraste (mismas reglas que el back) y botón para volver al negro y dorado.
  - **Datos del local:** latitud y longitud (con enlace al mapa), capacidad, y en las fotos la etiqueta de portada y el botón para elegirla.
  - Admin y superadmin editan; manager y RRPP solo ven. El panel conserva el estilo griego de la app.
- **Página pública `/b/:subdominio`** (`pages/PaginaBoliche.jsx`, estilos en `styles/boliche.css`): diseño propio del boliche, negro y dorado por defecto o los colores que eligió. Abre en modo oscuro y tiene su botón claro/oscuro (alterna solo esa página, no la app). Muestra portada, capacidad, ubicación y redes, galería, próximos eventos con sus entradas (precio online y de puerta, disponible, agotada o no disponible) y sus mesas VIP, las mesas VIP del local y la carta de bebidas por categoría. `/explorar` usa la portada de cada boliche.
- **Probado en un navegador real** con la cuenta de un admin: página pública en los dos modos y cada pestaña del panel (el servidor de desarrollo se levanta con la base migrada: `plataforma` en el Docker local).

**Falta / mejoras menores de la fase 1B**
- [ ] Probar las altas desde los formularios del panel (hoy están probadas en la API con 167 checks y la pantalla se vio en el navegador) y la subida de fotos desde la pantalla.
- [ ] Revisar el panel y la página pública en celular (los estilos ya tienen reglas para pantallas chicas, falta verlos).
- [ ] Confirmar con el equipo la tipografía de la sección (hoy la misma de la app) y si el negro y dorado alcanza solo a la página pública (como está hoy) o también al panel.

## 6.1C Fase 2: entradas, QR y puerta

- **Esquema** (`database/00_schema_fase2.sql`): `compra`, `entrada` (una por persona, con QR y DNI) y `acceso_puerta`; triggers de cupo vendido y de no bajar el cupo por debajo de lo vendido; función que cancela las compras vencidas. Todo con claves compuestas por boliche.
- **API:** compra pública sin cuenta (`/publico/.../comprar`) o con la cuenta del cliente, compra consultable por link, ventas por evento (cada rol ve lo suyo), pago y cancelación manuales, venta en puerta, y control de acceso (escanear, buscar por DNI, reingreso, resumen y movimientos). Cupos con bloqueo de filas: **8 compras a la vez por 3 entradas aceptan exactamente 3**; **6 escaneos simultáneos del mismo QR dejan entrar a uno**.
- **Front:** formulario de compra (una fila de nombre, apellido y DNI por entrada, con el total y el 6 %), página de la compra con los QR, "Mis entradas" para el cliente, pestañas **Ventas** (confirmar o cancelar pagos, venta en puerta) y **Puerta** (escanear con lector o cámara, buscar por DNI, reingreso, contadores). Probado de punta a punta en el navegador.
- **Pruebas:** `pruebas/api_fase2.py` (99).

## 6.1D Fase 3: pagos

- **Esquema** (`00_schema_fase3.sql`): `boliche_cuenta_cobro`, `pago` y `notificacion` (cola de avisos).
- **API:** cuenta de cobro del boliche, **aviso de pago firmado** (confirma solo; tolera repetidos, montos de más y de menos, compras vencidas), pagos "a revisar" (resolver o **reactivar** una compra vencida), avisos por WhatsApp y email con reintentos, y el 6 % de la plataforma. Límite de intentos de compra por dirección.
- **Front:** la compra muestra a dónde transferir (con botones para copiar), pestaña **Pagos** (cuenta, pagos para revisar, historial, avisos enviados).
- **Pruebas:** `api_fase3.py` (68) y `api_fase3_servicios.py` (10: webhook sin secreto, reintento contra un WhatsApp falso y límite de compras).
- **Falta:** elegir y conectar el servicio que detecta la transferencia y los de WhatsApp y email (sección 4).

## 6.1E Fase 4: RRPP

- **Esquema** (`00_schema_fase4.sql`): `talonario`, `lista_invitados`, `invitado` (con trigger de edad mínima), y la compra atada al talonario.
- **API:** talonarios con link propio (los asigna el admin o el manager a su equipo), ventas adjudicadas al RRPP con su comisión fijada al cobrar, listas de invitados (cada RRPP las suyas), resultados (por RRPP, con entradas asignadas), ranking (sin montos) y "mis ventas" (con el nombre de quien pagó). Los invitados entran por la puerta con su DNI.
- **Front:** pantalla principal del RRPP y del manager (**Resultados RRPP**), **Talonarios**, **Listas**, link `/t/CODIGO` con el aviso "estás comprando con el link de…", e invitados en la puerta.
- **Pruebas:** `api_fase4.py` (115).

## 6.1F Fase 5: personal, proveedores y finanzas

- **Esquema** (`00_schema_fase5.sql`): `personal` (con contactos y eventos en que trabajó), `evento_dotacion`, `proveedor`, `gasto` e `ingreso`.
- **API:** fichas del personal con contactos, historial y cuánto cobra; asignación a cada noche con su pago y la dotación (seguridad, limpieza, barman); proveedores con lo gastado; gastos e ingresos; y el resumen en **tres niveles** (noche, boliche y admin con todos sus locales) con período.
- **Front:** pestañas **Personal**, **Proveedores** e **Ingresos y gastos**, y la pantalla **Finanzas** del admin.
- **Pruebas:** `api_fase5.py` (121, con los montos exactos de cada nivel).

## 6.1G Fase 6: plataforma

- **Esquema** (`00_schema_fase6.sql`): `descuento`, `usuario_recuperacion` y columnas de la verificación en dos pasos, `cobro_plataforma`, y las marcas de datos borrados.
- **API:** descuentos del admin aplicados a las compras del cliente con cuenta; **verificación en dos pasos** (TOTP verificado contra los vectores de la RFC 6238; códigos de recuperación; reuso de un código rechazado; bloqueo tras 5 fallos; modo obligatorio con sesión limitada; el superadmin la restablece); **borrado de datos a los 3 meses** (script `npm run limpiar-datos` y una vez por día); cobros y mensualidades del superadmin y el resumen de lo que gana la plataforma.
- **Front:** segundo paso en el login, pantalla **Seguridad** (QR, códigos de recuperación), pestaña **Descuentos**, pantalla **Plataforma** del superadmin (cobros, mensualidades, ganancias, borrado de datos), subdominio por boliche (`VITE_DOMINIO_BASE`).
- **Despliegue:** `docker-compose.yml` (demostración), `deploy/docker-compose.prod.yml` (producción con HTTPS), `frontend/nginx-https.conf`, `deploy/backup.sh` y la guía `docs/DESPLIEGUE.md`. Las imágenes de Docker se construyeron y la configuración de nginx se validó.
- **Pruebas:** `api_fase6.py` (130) y `api_fase6_servicios.py` (18: verificación obligatoria y límite de inicios de sesión).

## 6.2 Lo que falta de la fase 1

Nada obligatorio. Mejoras menores anotadas:
- [ ] La lista de boliches del superadmin queda ancha en pantallas chicas (se desplaza hacia el costado).
- [ ] El manager ve el bloque "próximamente" antes que sus eventos; conviene bajarlo cuando haya datos reales.
- [ ] Aplicar Space Grotesk + glassmorphism de Notion, si el equipo lo pide más adelante (hoy se conserva el estilo actual).

## 6.3 Lo que falta

Están hechas las 6 fases. Lo que queda no es código sino **definiciones y conexiones** (sección 4): los montos, el dominio y el proveedor del VPS, el servicio que detecta la transferencia y los de WhatsApp y email. Y algunos ajustes menores:
- [ ] Revisar el panel y las páginas públicas en celular (los estilos tienen reglas para pantallas chicas, falta recorrerlas).
- [ ] Probar la lectura del QR con la cámara en un celular real (usa la API `BarcodeDetector` del navegador; con un lector de QR o pegando el código ya funciona).
- [ ] Reserva de mesas VIP por el cliente (hoy se ve cuáles hay y su estado; el admin las marca reservadas).
- [ ] Comisiones, resultados y finanzas por período en una pantalla de exportación (hoy se ven en pantalla).

## 6.4 Cosas a tener en cuenta

- Las pruebas de la API borran y crean datos: correrlas solo sobre una base recién cargada (`./database/cargar_base.sh --reset`), una por vez: `npm run prueba-api`, `npm run prueba-imagenes` y `npm run prueba-fase1b`.
- **Si ya tenías la base de la fase 1:** o la recreás con `./database/cargar_base.sh --reset`, o le aplicás `database/migraciones/fase_1b.sql` desde pgAdmin (conserva tus datos). Hay que reiniciar el back.
- La dirección pública de cada boliche será `/b/:subdominio` hasta que se defina el dominio de la plataforma.
- Un RRPP puede ir con un manager o directo con el admin (el manager es opcional, como dice Notion).
- La verificación extra de los admins, los descuentos del cliente y el borrado de datos a los 3 meses no están hechos todavía; la tabla `usuario` ya guarda `ultima_actividad` para el borrado.

---

# 7. Referencia de la API

Todas las rutas empiezan con `/api`. Salvo las públicas, requieren `Authorization: Bearer <token>`.

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `POST /auth/register` | Cualquiera | Crea una cuenta de **cliente** |
| `POST /auth/login` | Cualquiera | Inicia sesión; devuelve el token y los boliches de la persona |
| `GET /auth/perfil` | Con sesión | Datos de la persona y sus boliches |
| `GET /publico/boliches` | Cualquiera | Boliches activos |
| `GET /publico/boliches/:subdominio` | Cualquiera | Página de un boliche con sus próximos eventos |
| `GET /boliches` | Superadmin, admin, manager, RRPP | Boliches a los que accede la persona |
| `POST /boliches` | Superadmin | Crea un boliche con su admin (`admin` nuevo o `id_admins`) |
| `GET /boliches/:id` | Los del boliche | Un boliche con sus admins y su equipo |
| `PUT /boliches/:id` | Superadmin (todo), admin (solo datos del local) | Edita el boliche |
| `POST /boliches/:id/admins` · `DELETE /boliches/:id/admins/:idUsuario` | Superadmin | Suma o quita un admin |
| `GET /boliches/:id/equipo` | Superadmin, admin, manager | Equipo de RRPP (el manager ve los suyos y los libres) |
| `POST /boliches/:id/equipo` | Superadmin, admin, manager | Da de alta un manager o un RRPP |
| `PUT /boliches/:id/equipo/:idUsuario` | Superadmin, admin, manager | Comisión y manager (el manager solo asigna y desasigna) |
| `DELETE /boliches/:id/equipo/:idUsuario` | Superadmin, admin | Baja: sale del equipo y se desactiva la cuenta |
| `GET /boliches/:id/eventos` | Los del boliche | Eventos (`?estado=` y `?proximos=true`) |
| `POST /boliches/:id/eventos` | Superadmin, admin, manager | Crea un evento |
| `PUT /boliches/:id/eventos/:idEvento` | Superadmin, admin, manager (solo los suyos) | Edita un evento |
| `DELETE /boliches/:id/eventos/:idEvento` | Superadmin, admin | Borra un evento |
| `GET /usuarios` · `POST /usuarios` · `PUT /usuarios/:id` | Superadmin | Lista usuarios, da de alta admins, activa o desactiva cuentas |

Los errores devuelven `{ "mensaje": "..." }` con el código HTTP que corresponde (400 datos inválidos, 401 sin sesión, 403 sin permiso, 404 no existe o no es tuyo, 409 dato repetido).

## 7.1 Rutas de la fase 1B

Ahora cuelgan de `/boliches/:id` (404 si la persona no es del boliche). **Leen:** superadmin, admin, manager y RRPP. **Escriben:** superadmin y admin. Las imágenes se suben mandando el archivo como cuerpo (`Content-Type: image/jpeg|png|webp`, hasta 5 MB).

| Método y ruta | Qué hace |
|---|---|
| `GET/POST /fotos` · `PUT/DELETE /fotos/:idFoto` | Fotos del boliche (máx. 10). `PUT {es_portada:true}` cambia la portada |
| `GET/POST /eventos/:id/entradas` · `PUT/DELETE /eventos/:id/entradas/:idEntrada` | Tandas y VIP: `nombre, tipo, precio_virtual, precio_puerta, cupo, estado, orden` |
| `GET/POST /bebidas` · `PUT/DELETE /bebidas/:idBebida` | Carta: `categoria, nombre, descripcion, precio, disponible` |
| `POST/DELETE /bebidas/:idBebida/imagen` | Foto de la bebida |
| `GET/POST /mesas-vip` · `PUT/DELETE /mesas-vip/:idMesa` | Mesas VIP: `nombre, capacidad, precio, descripcion, activa` |
| `POST/DELETE /mesas-vip/:idMesa/imagen` | Foto de la mesa |
| `GET /eventos/:id/mesas-vip` · `PUT /eventos/:id/mesas-vip/:idMesa` | Qué mesas ofrece el evento. `PUT {ofrecida, estado?}` |
| `POST/DELETE /eventos/:id/imagen` | Flyer del evento |
| `GET /tema` · `PUT /tema` · `DELETE /tema?modo=` | Colores del boliche. `PUT {modo, fondo, tarjetas, texto, acento}`; `DELETE` vuelve al negro y dorado |
| `GET /publico/boliches/:subdominio` | Página pública: ficha, fotos (portada primero), colores, bebidas disponibles, mesas VIP activas y próximos eventos con sus entradas (sin cupo) y mesas |
| `GET /publico/boliches` | Lista pública con `portada`, dirección y capacidad |

## 7.2 Rutas de las fases 2 a 6

Salvo las públicas, requieren `Authorization: Bearer <token>`. Lo que cuelga de `/boliches/:id` da 404 a quien no es de ese boliche.

**Compra y puerta (fase 2)**

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `POST /publico/boliches/:sub/eventos/:id/comprar` | Cualquiera (con o sin sesión) | Compra: `{items:[{id_tipo_entrada, nombre, apellido, dni}], contacto_email?, contacto_telefono?, talonario?}` |
| `GET /publico/compras/:token` | Quien tiene el link | La compra; los QR salen una vez paga. Pendiente: trae la cuenta donde transferir |
| `GET /cliente/compras` | Cliente | Sus compras con QR |
| `GET /boliches/:id/eventos/:idEvento/ventas` | Admin, manager, RRPP | Ventas (cada rol ve lo suyo; DNI según rol) |
| `PUT /boliches/:id/compras/:idCompra/pagar` · `/cancelar` | Admin, manager | Confirma el pago a mano / cancela una compra sin pagar |
| `POST /boliches/:id/eventos/:idEvento/venta-puerta` | Admin, manager, RRPP | Venta en el local (precio de puerta) |
| `POST .../puerta/escanear` · `/buscar` · `/reingreso` · `/invitado` | Admin, manager, RRPP | Valida un QR (una sola vez), busca por DNI, registra un reingreso, deja entrar a un invitado de lista |
| `GET .../puerta/resumen` · `/accesos` | Admin, manager, RRPP | Contadores y últimos movimientos |

**Pagos (fase 3)**

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `POST /pagos/webhook` | El servicio de pagos (firma `X-Firma`) | Confirma una compra por su referencia |
| `GET/PUT /boliches/:id/cuenta-cobro` | Admin, manager (lee) · Admin (edita) | Cuenta donde se cobra |
| `GET /boliches/:id/pagos[?estado=]` · `PUT /pagos/:id/resolver` · `/reactivar` | Admin, manager | Pagos y los que hay que revisar |
| `GET /boliches/:id/notificaciones` | Admin, manager | Avisos enviados a clientes |

**RRPP (fase 4)**

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /publico/talonarios/:codigo` | Cualquiera | A qué evento lleva el link de un RRPP |
| `GET/POST /boliches/:id/eventos/:idEvento/talonarios` · `PUT/DELETE .../:idTalonario` | Todos ven lo suyo · Admin y manager asignan | Talonarios |
| `GET /.../eventos/:idEvento/listas` · `POST/PUT/DELETE` de listas e invitados | Todos ven lo suyo · el RRPP arma las suyas | Listas de invitados |
| `GET /boliches/:id/rrpp/resultados` · `/ranking` · `/mis-ventas` | Admin, manager, RRPP | Resultados, ranking (sin montos) y ventas con quién pagó |

**Personal, proveedores y finanzas (fase 5)** — solo admin y superadmin

| Método y ruta | Qué hace |
|---|---|
| `GET/POST /boliches/:id/personal` · `GET/PUT/DELETE .../:idPersonal` · `POST/DELETE .../contactos` | Fichas del personal |
| `GET .../eventos/:idEvento/personal` · `PUT/DELETE .../:idPersonal` · `PUT .../dotacion` | Personal de cada noche y la dotación |
| `GET/POST/PUT/DELETE /boliches/:id/proveedores` · `/gastos` · `/ingresos` | Proveedores, gastos e ingresos |
| `GET .../eventos/:idEvento/finanzas` · `GET /boliches/:id/finanzas` · `GET /finanzas` | Resumen: de la noche, del boliche y del admin con todos sus locales (`?desde=&hasta=`) |

**Plataforma (fase 6)**

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /publico/boliches/:sub/descuento` | Cliente con sesión | El descuento que le corresponde |
| `GET/POST/PUT/DELETE /boliches/:id/descuentos` | Admin | Descuentos del boliche |
| `POST /auth/login` → `{requiere_verificacion, ticket}` · `POST /auth/2fa/verificar` | Admins | Segundo paso del login |
| `GET /auth/2fa` · `POST /auth/2fa/preparar` · `/activar` · `/desactivar` | Admin, superadmin | Verificación en dos pasos |
| `DELETE /usuarios/:id/2fa` | Superadmin | Restablece la verificación de un admin |
| `GET /plataforma/resumen` · `GET/POST /plataforma/cobros` · `PUT .../:id/pagar` | Superadmin | Cobros, mensualidades y lo que gana la plataforma |
| `POST /plataforma/retencion/ejecutar` | Superadmin | Corre ahora el borrado de datos vencidos |

---

# 8. Bitácora de trabajo

Qué se hizo y cuándo, en orden. Se agrega una línea por cada cambio importante (y se commitea al menos cada 10 minutos de trabajo).

| Fecha | Qué se hizo |
|---|---|
| 2026-10-27 | Copia del proyecto anterior a la carpeta `Proyecto`, con PostgreSQL local administrado desde pgAdmin 4 en lugar de Supabase; script `database/cargar_base.sh`; repo privado en GitHub |
| 2026-10-27 | Corrección: el `.env` había perdido `JWT_SECRET` y el login fallaba; ahora el servidor avisa al arrancar si falta |
| 2026-10-27 | Lectura de la página de Notion "Proyecto nuestro" y **documentación completa en este README** (secciones 1 a 4) |
| 2026-10-27 | Decisión del equipo: conservar el estilo del front (tipografía griega, mármol, modo oscuro de Ares) y cambiar todo lo demás; el sistema anterior se reemplaza por completo; todo el trabajo se hace en `main` |
| 2026-10-27 | Historial de git limpio, con un único autor |
| 2026-10-27 | **Base de datos:** esquema multi-boliche con los 5 roles; la separación por local queda garantizada por la base (claves compuestas y triggers); 14 reglas probadas a mano |
| 2026-10-27 | **API:** autenticación de los 5 roles, boliches y sus admins, equipo de RRPP con comisión, eventos y parte pública; un único middleware decide el acceso a cada boliche |
| 2026-10-27 | **Pruebas:** 82 comprobaciones de punta a punta (aislamiento entre boliches y permisos de cada rol), todas pasan. Se encontró y corrigió un error al crear eventos (`artistas` como lista) |
| 2026-10-27 | Script para crear un superadmin real, cuentas demo documentadas y referencia de la API |
| 2026-10-27 | **Front:** se quitan las pantallas del sistema anterior y se arma la base: sesión con los 5 roles, menú por rol, acceso, landing, boliches y usuarios |
| 2026-10-27 | **Front:** ficha del boliche con eventos, equipo de RRPP y datos del local (el superadmin suma y quita admins) |
| 2026-10-27 | **Front:** parte pública (`/explorar` y `/b/:subdominio`); el cliente se registra y entra a la lista de boliches |
| 2026-10-27 | README del front reescrito para la plataforma; estado de la fase 1: terminada |
| 2026-10-27 | Historial unificado: todo en `main` (una sola rama); commit automático cada 10 minutos |
| 2026-10-27 | **Fase 1B, base de datos:** fotos con portada, entradas por evento, bebidas, mesas VIP y colores del boliche; triggers de cupos y de máximo de fotos; migración `fase_1b.sql` probada sobre una base vieja |
| 2026-10-27 | **Fase 1B, API:** controladores y rutas de fotos, entradas, bebidas, mesas VIP y colores; página pública completa; flyer de eventos |
| 2026-10-27 | **Pruebas de la fase 1B:** `api_fase1b.py` (167 checks) y `api_imagenes.py` actualizado (42); con la fase 1 suman 291, todas OK |
| 2026-10-27 | Corrección: el servidor se caía si Postgres cortaba una conexión inactiva; el pool ahora lo registra y sigue. También se corrigió `cargar_base.sh`, que chequeaba una tabla del sistema anterior |
| 2026-10-27 | **Front 1B (base):** clientes HTTP, reglas de contraste, `TemaBoliche` (colores propios con Ant Design aislado), fotos con portada en el panel y en `/explorar` |
| 2026-10-28 | Se levanta la app para probar: migración de la base local (`plataforma`) con los datos demo de la 1B, back en el puerto 3001 y front en el 5174 |
| 2026-10-28 | **Front 1B:** pestañas Entradas, Bebidas, Mesas VIP y Diseño en el panel del boliche; latitud, longitud y portada en Datos del local; botón de imagen compartido (`AccionesImagen`) |
| 2026-10-28 | **Front 1B:** página pública del boliche con su diseño propio (negro y dorado, modo claro/oscuro), entradas, mesas VIP y carta. Probado en navegador; se corrigieron acciones cortadas en las tablas |
| 2026-10-28 | **Fase 2, API:** compra con DNI, cupos con bloqueo de filas, vencimiento de reservas, QR de un solo uso, venta en puerta y control de acceso (99 comprobaciones, incluidas compras y escaneos simultáneos) |
| 2026-10-28 | **Fase 2, front:** compra con QR, "Mis entradas", pestañas Ventas y Puerta; probado de punta a punta en el navegador |
| 2026-10-28 | **Fase 3:** cuenta de cobro, confirmación automática por aviso firmado, pagos a revisar y reactivación, cola de avisos con reintentos, 6 % de la plataforma, límite de intentos (78 comprobaciones) |
| 2026-10-28 | **Fase 4:** talonarios con link propio, comisión fijada al cobrar, listas de invitados con edad mínima, resultados, ranking y "mis ventas" (115 comprobaciones) y las pantallas del RRPP y del manager |
| 2026-10-28 | **Fase 5:** personal externo, dotación por evento, proveedores, gastos e ingresos y resumen en tres niveles (121 comprobaciones) y sus pantallas |
| 2026-10-28 | **Fase 6:** descuentos, verificación en dos pasos (TOTP validado con los vectores de la RFC 6238), borrado de datos a los 3 meses, cobros y mensualidades del superadmin (148 comprobaciones) y sus pantallas |
| 2026-10-28 | **Despliegue:** docker compose de demostración y de producción con HTTPS, subdominio por boliche, copias de seguridad y guía `docs/DESPLIEGUE.md`; las imágenes se construyeron y la configuración de nginx se validó |
| 2026-10-28 | Corrección: un código de verificación incorrecto cerraba la sesión del front (el interceptor trataba el 401 como sesión vencida); el pool de la base ya no tira el servidor (fase 1B) |
| 2026-10-28 | Todas las fases hechas. Total: 852 comprobaciones automáticas, todas OK |
| *Próximo* | Definir con el equipo lo pendiente de la sección 4 (dominio, VPS, servicio de pagos y de mensajes) y repasar el panel en celular |
