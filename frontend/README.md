# Frontend — Plataforma para boliches y bares

Aplicación React que consume la API del back (ver el README de la raíz, secciones 1 y 7). Tiene un panel para cada rol
y una parte pública para los clientes. **El estilo visual se conserva** de la versión anterior: tipografía griega
(Cinzel + Philosopher), mármol en el modo claro y modo oscuro de Ares, con Ant Design como base de componentes.

## Cómo correrlo

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # genera dist/
```

En desarrollo, las llamadas a `/api/...` se redirigen al back (por defecto `http://localhost:3000`).
Para apuntar a otro back: `VITE_PROXY_TARGET=http://localhost:3001 npm run dev`. Variable opcional: `VITE_API_URL`.

## Rutas y quién entra

| Ruta | Pantalla | Quién |
|---|---|---|
| `/` | Landing de la plataforma | Cualquiera |
| `/login`, `/registro` | Acceso (el registro crea cuentas de **cliente**) | Cualquiera |
| `/explorar` | Lista de boliches activos | Cualquiera |
| `/b/:subdominio` | Página pública de un boliche con su diseño propio (negro y dorado, modo claro/oscuro): ficha, fotos, eventos con entradas y mesas, mesas VIP y carta. Con `VITE_DOMINIO_BASE`, también en `subdominio.dominio` | Cualquiera |
| `/t/:codigo` | Link de venta de un RRPP: lleva a la página del boliche adjudicando las compras a él | Cualquiera |
| `/compra/:token` | Una compra con sus QR (se ve con el link, sin cuenta) | Quien tiene el link |
| `/mis-entradas` | Las compras del cliente con su cuenta | Cliente |
| `/boliches` | Lista de boliches; el superadmin los crea con su admin | Superadmin y admin |
| `/boliches/:id` | Ficha del boliche con pestañas según el rol: eventos, entradas, **ventas, pagos, puerta**, **resultados RRPP, talonarios, listas**, **personal, proveedores, ingresos y gastos, descuentos**, bebidas, mesas VIP, diseño, equipo y datos del local | Los del boliche y el superadmin (cada rol ve y edita lo suyo) |
| `/finanzas` | Ingresos, gastos y balance de todos los boliches del admin | Superadmin y admin |
| `/plataforma` | Cobros y mensualidades a los boliches, lo que gana la plataforma, borrado de datos | Superadmin |
| `/seguridad` | Verificación en dos pasos (QR y códigos de recuperación) | Superadmin y admin |
| `/usuarios` | Usuarios del sistema; alta de admins | Superadmin |

Al iniciar sesión, cada rol va a su pantalla (`inicioDe` en `utils/formato.js`): superadmin y admin a `/boliches`, manager y RRPP
directo a su boliche, y el cliente a `/explorar`. Quien no es de un boliche ve "no encontramos este boliche" (el back responde 404).

## Estructura

```
src/
├── main.jsx            Punto de entrada: monta la app con Router, tema y sesión
├── App.jsx             Mapa de rutas
├── pages/              Una pantalla por ruta
├── components/         Layout (menú por rol), PaginaCrud (tabla + formulario), FormModal, CabeceraPublica...
│   ├── boliche/        Pestañas de la ficha del boliche (una por tema) y TemaBoliche (colores propios de cada boliche)
│   └── ventas/         Formulario de compra, QR de cada entrada, venta en puerta
├── api/                Clientes HTTP: client.js (CRUD genérico) y plataforma.js (boliches, ventas, puerta, pagos, RRPP, finanzas, plataforma...)
├── services/           Axios configurado (token y manejo de 401) y autenticación
├── context/            Sesión de la persona (AuthContext)
├── hooks/              usePermisos (qué botones ve cada rol), useRecurso, useTema
├── utils/              Formatos (fechas, roles, dinero), colores del boliche, subdominio, tema claro/oscuro, splash y tema de Ant Design
└── styles/             CSS dividido por sección
```

## Cómo agregar una tabla con alta y edición

`components/PaginaCrud.jsx` arma la pantalla completa a partir de un objeto `config` (columnas, campos del formulario, qué rol puede
crear o editar). Para un recurso que cuelga de un boliche se usa `apiDeBoliche(idBoliche, "eventos")` y la opción `embebida: true`
(dentro de una pestaña). Ejemplos: `pages/Usuarios.jsx` (el más corto) y las pestañas de `pages/BolicheDetalle.jsx`.

- **Los permisos del front solo muestran u ocultan botones.** El back verifica todo y es quien decide.
- **Lo que llega en otras fases** (entradas, ventas, finanzas) se marca con `components/Proximamente.jsx`.

## Estilos

Las reglas del proyecto siguen igual: variables de color en `styles/base.css` (las dos paletas, clara y oscura), un estilo por línea,
y colores solo con variables. `styles/decoracion.css` y `styles/lineas.css` dan el estilo griego del modo claro y el de Ares del oscuro.
