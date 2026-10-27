import { useSyncExternalStore } from "react";
import { alternarTema, suscribirTema, temaActual } from "../utils/tema.js";

// Devuelve [tema, alternar]. "tema" es "light" o "dark" y es el mismo en todos los componentes
// (por eso hay un solo estado compartido en utils/tema.js y no uno por botón).
// index.html aplica el tema antes de cargar React para evitar un parpadeo.
export default function useTema() {
  const tema = useSyncExternalStore(suscribirTema, temaActual);
  return [tema, alternarTema];
}
