import { DeleteOutlined, PictureOutlined } from "@ant-design/icons";
import { Button, Popconfirm } from "antd";
import SubirImagen from "./SubirImagen.jsx";

// Botones de una fila para subir, cambiar o quitar su imagen (evento, bebida, mesa VIP).
//   imagen      -> la ruta actual (si hay, se ofrece "Cambiar" y "Quitar")
//   onSubir     -> (archivo) => promesa que sube la imagen
//   onBorrar    -> () => promesa que la quita
//   recargar    -> recarga la lista cuando termina
export default function AccionesImagen({ imagen, onSubir, onBorrar, recargar }) {
  return (
    <>
      <span title={imagen ? "Cambiar imagen" : "Subir imagen"}>
        <SubirImagen tipo="text" texto="" icono={<PictureOutlined />} onSubir={onSubir} alTerminar={recargar} />
      </span>
      {imagen && (
        <Popconfirm
          title="¿Quitar la imagen?"
          okText="Quitar"
          cancelText="Cancelar"
          okButtonProps={{ danger: true }}
          onConfirm={async () => {
            await onBorrar();
            await recargar();
          }}
        >
          <Button type="text" danger icon={<DeleteOutlined />} aria-label="Quitar imagen" />
        </Popconfirm>
      )}
    </>
  );
}
