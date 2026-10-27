# Proyecto — Plataforma para boliches y bares

Fuente de esta documentación: la página de Notion **"Proyecto nuestro"** (6 de octubre de 2026, @Gianluca). Todo lo que figura en la sección 1 es lo que dice esa página; lo que decidimos nosotros al implementarlo está en la sección 2 y lo que sigue sin definir, en la sección 4.

- **Estado actual:** fase 1 en marcha (ver "Plan de trabajo"). El front se adapta a la plataforma pero **conserva su estilo actual**.
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

---

# 3. Plan de trabajo

| Fase | Contenido | Estado |
|---|---|---|
| **0** | Documentación en este README, copia del proyecto con PostgreSQL local | ✅ Hecha |
| **1** | Esquema multi-boliche; los 5 roles con su login; **panel del superadmin** (boliches y sus admins, usuarios); **panel del admin** (sus boliches, equipo y eventos de cada noche); **panel del manager** (su equipo y eventos); **página pública del boliche**; pruebas de que cada local ve únicamente lo suyo. Todo con el estilo actual del front | 🔨 Base de datos y API terminadas y probadas; **falta el front** |
| **2** | Entradas: tandas, VIP, precios virtual y de puerta, capacidad; compra con nombre, apellido y DNI; QR de un solo uso y control en puerta | ⏳ |
| **3** | Pagos: confirmación automática de la transferencia, avisos por WhatsApp y Gmail, comisión de la plataforma (6 %) | ⏳ Depende de definiciones |
| **4** | RRPP: alta y asignación, talonarios con link propio, listas de invitados, comisión, rankings y resultados | ⏳ |
| **5** | Personal externo (fichas y dotación por evento), proveedores, gastos e ingresos en sus tres niveles | ⏳ |
| **6** | Cuenta del cliente y descuentos, verificación extra del admin, borrado de datos a los 3 meses, cobros y mensualidades del superadmin, despliegue en el VPS | ⏳ |

---

# 4. Pendientes por definir

Lo que figura en Notion como sin resolver. Frena parte de las fases 3 y 6.

- [ ] Los montos: la mensualidad por boliche y el monto de un evento único.
- [ ] Qué dominio va a tener la plataforma (cada boliche usa un subdominio de ese dominio).
- [ ] Cómo funciona el link del talonario: si va impreso en las entradas a mano y con qué banco o cuenta se conecta.
- [ ] Con qué servicio se detecta que llegó la transferencia para confirmarla automáticamente.
- [ ] Cómo se obtiene el teléfono o el Gmail del cliente para el aviso, si al comprar solo se piden nombre, apellido y DNI.
- [ ] Si la regla de los 3 meses vale también para los clientes con cuenta, o solo para quienes compran una vez.
- [x] Qué backend y base de datos usar: **Node.js + PostgreSQL** (ver sección 2). Falta elegir el proveedor del VPS.

---

# 5. Puesta en marcha

## Base de datos con pgAdmin 4

La base es un PostgreSQL local (versión 12 o superior) que se maneja desde pgAdmin 4.

1. **Conexión.** En pgAdmin: *Servers → tu servidor* (host `localhost`, puerto `5432`, usuario `postgres`). Esos mismos datos van en el `.env`.
2. **Archivo `.env`.** Copiar `.env.example` como `.env` y completar `DB_PASSWORD`. **No borrar las demás líneas** (sobre todo `JWT_SECRET`). El `.env` no se sube a GitHub.
3. **Crear y cargar la base**, de cualquiera de estas dos formas:
   - **Con el script:** `./database/cargar_base.sh` crea la base y carga el esquema y los datos de prueba. Con `--reset` la borra y la vuelve a crear.
   - **A mano en pgAdmin:** clic derecho en *Databases → Create → Database…*; luego *Query Tool* sobre esa base y ejecutar, en orden, `database/00_schema.sql` y `database/01_datos_prueba.sql`.
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

## Cuentas de prueba

Los datos de prueba (`database/01_datos_prueba.sql`) traen una cuenta de cada rol, todas con la contraseña **`demo12345`** (solo para desarrollo):

| Email | Rol | A qué accede |
|---|---|---|
| `superadmin@demo.com` | Superadmin | Todos los boliches |
| `admin1@demo.com` | Admin | Boliche Uno y Bar Dos |
| `admin2@demo.com` | Admin | Club Tres |
| `manager1@demo.com` | RRPP manager | Boliche Uno |
| `rrpp1@demo.com`, `rrpp2@demo.com` | RRPP | Boliche Uno |
| `cliente@demo.com` | Cliente | Solo lo público |

Para crear un superadmin real (sin los datos de prueba): `npm run crear-superadmin -- email@dominio.com "una contraseña" Nombre Apellido`.

---

# 6. Estado de avance

Se actualiza con cada cambio importante. Última actualización: fase 1, base de datos y API.

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

## 6.2 Lo que falta de la fase 1

- [ ] **Front:** adaptar las pantallas al sistema nuevo, manteniendo el estilo actual (tipografía griega, mármol, modo oscuro de Ares):
  - login y registro de clientes;
  - panel del superadmin (boliches, sus admins y usuarios);
  - panel del admin (sus boliches, equipo y eventos);
  - panel del manager (su equipo y eventos) y panel mínimo del RRPP;
  - lista de boliches y página pública de cada boliche (`/b/:subdominio`).
- [ ] Quitar del front las pantallas del sistema anterior (eventos de una organizadora, propuestas, tareas, etc.).
- [ ] Probar el front de punta a punta en un navegador, en los dos modos de color y en celular.

## 6.3 Lo que falta de las fases siguientes

Ver la tabla de la sección 3: entradas y QR (fase 2), pagos (fase 3), RRPP con talonarios y listas (fase 4), personal externo y finanzas (fase 5), y cuenta del cliente, verificación extra, borrado a los 3 meses y despliegue (fase 6). Las fases 3 y 6 dependen de los pendientes de la sección 4.

## 6.4 Cosas a tener en cuenta

- Las pruebas de la API borran y crean datos: correrlas solo sobre una base recién cargada (`./database/cargar_base.sh --reset`).
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
