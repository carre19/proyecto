import { useAuth } from "../context/AuthContext.jsx";

// Qué puede hacer la persona actual. Solo sirve para mostrar u ocultar botones:
// el back vuelve a verificar todo y es quien decide.
//   Superadmin   -> todo, en todos los boliches
//   Admin        -> sus boliches: datos del local, equipo de RRPP y comisión, eventos
//   RRPP manager -> su boliche: alta y asignación de RRPP, y sus eventos
//   RRPP         -> consulta su boliche
//   Cliente      -> solo lo público
export default function usePermisos() {
  const { usuario } = useAuth();
  const rol = usuario?.rol;
  const boliches = usuario?.boliches ?? [];

  const esSuperadmin = rol === "superadmin";
  const esAdmin = rol === "admin";
  const esManager = rol === "rrpp_manager";
  const esRrpp = rol === "rrpp";
  const esCliente = rol === "cliente";

  return {
    yo: usuario?.id,
    rol,
    boliches,
    esSuperadmin,
    esAdmin,
    esManager,
    esRrpp,
    esCliente,
    // Tiene panel (todos menos el cliente).
    tienePanel: Boolean(rol) && !esCliente,
    // Quién puede crear boliches, editar datos del local, armar el equipo y crear eventos.
    puedeCrearBoliches: esSuperadmin,
    puedeEditarLocal: esSuperadmin || esAdmin,
    puedeVerEquipo: esSuperadmin || esAdmin || esManager,
    puedeFijarComision: esSuperadmin || esAdmin,
    puedeCrearEventos: esSuperadmin || esAdmin || esManager,
  };
}
