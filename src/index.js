import "dotenv/config";
import express from "express";
import cors from "cors";
import { DIR_UPLOADS, URL_UPLOADS } from "./utils/imagenes.js";
import authRoutes from "./routes/auth.routes.js";
import publicoRoutes from "./routes/publico.routes.js";
import bolicheRoutes from "./routes/boliche.routes.js";
import usuarioRoutes from "./routes/usuario.routes.js";
import clienteRoutes from "./routes/cliente.routes.js";

// Sin JWT_SECRET no se pueden firmar sesiones: mejor frenar al arrancar con un aviso claro que fallar al iniciar sesión.
if (!process.env.JWT_SECRET) {
    console.error("Falta JWT_SECRET en el archivo .env (copiá .env.example y completá ese valor).");
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

// Imágenes subidas: públicas (se ven en la página de cada boliche), sin listar carpetas y sin que el navegador adivine el tipo.
app.use(URL_UPLOADS, express.static(DIR_UPLOADS, {
    index: false,
    dotfiles: "ignore",
    maxAge: "7d",
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
}));

app.use("/api/auth", authRoutes);
app.use("/api/publico", publicoRoutes);
app.use("/api/boliches", bolicheRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/cliente", clienteRoutes);

app.use((req, res) => {
    res.status(404).json({ mensaje: "Ruta no encontrada" });
});

// Errores al leer el cuerpo de la petición: siempre se responde en JSON, igual que el resto de la API.
app.use((error, req, res, next) => {
    if (error.type === "entity.too.large") {
        return res.status(413).json({ mensaje: "el archivo es demasiado grande (máximo 5 MB)" });
    }
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({ mensaje: "el cuerpo de la petición no es un JSON valido" });
    }
    console.error(error);
    res.status(500).json({ mensaje: "Error del servidor" });
});

app.listen(PORT, () => {
    console.log(`Servidor en http://localhost:${PORT}`);
});
