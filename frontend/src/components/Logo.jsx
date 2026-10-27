import { Link } from "react-router-dom";

// Marca de la app (punto + NOCTIS). "to" es a dónde lleva al hacer click.
export default function Logo({ to = "/" }) {
  return (
    <Link to={to} className="logo">
      <i />
      <span>NOCTIS</span>
    </Link>
  );
}
