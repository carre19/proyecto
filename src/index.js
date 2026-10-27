import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import publicoRoutes from "./routes/publico.routes.js";
import bolicheRoutes from "./routes/boliche.routes.js";
import usuarioRoutes from "./routes/usuario.routes.js";

// Sin JWT_SECRET no se pueden firmar sesiones: mejor frenar al arrancar con un aviso claro que fallar al iniciar sesión.
if (!process.env.JWT_SECRET) {
    console.error("Falta JWT_SECRET en el archivo .env (copiá .env.example y completá ese valor).");
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/publico", publicoRoutes);
app.use("/api/boliches", bolicheRoutes);
app.use("/api/usuarios", usuarioRoutes);

app.use((req, res) => {
    res.status(404).json({ mensaje: "Ruta no encontrada" });
});

app.listen(PORT, () => {
    console.log(`Servidor en http://localhost:${PORT}`);
});
