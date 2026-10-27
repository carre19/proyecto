import { SearchOutlined } from "@ant-design/icons";
import { Input, Tag } from "antd";
import { useAuth } from "../context/AuthContext.jsx";
import { rolDe } from "../utils/formato.js";

// Barra superior de cada página del panel: buscador (el texto lo maneja la página; "sinBuscador" lo oculta) y rol de la persona.
export default function Topbar({ busqueda, onBusqueda, placeholder, sinBuscador }) {
  const { usuario } = useAuth();
  return (
    <div className="topbar">
      {sinBuscador ? (
        <span />
      ) : (
        <Input
          className="search"
          size="large"
          allowClear
          prefix={<SearchOutlined />}
          value={busqueda}
          onChange={(e) => onBusqueda(e.target.value)}
          placeholder={placeholder}
        />
      )}
      <Tag className="role-pill role-pill--empresa" variant="outlined">
        ROL · {rolDe(usuario).toUpperCase()}
      </Tag>
    </div>
  );
}
