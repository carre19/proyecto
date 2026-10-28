import { UploadOutlined } from "@ant-design/icons";
import { App, Button, Upload } from "antd";
import { useState } from "react";
import { mensajeError } from "../services/api.js";

const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const MAXIMO_MB = 5;

// Botón para elegir una imagen y subirla. El back vuelve a verificar todo (reconoce el formato por su contenido);
// acá solo se evita mandar archivos que se sabe que van a ser rechazados.
//   onSubir(archivo) -> promesa que sube el archivo (si falla, se muestra el mensaje del back)
//   alTerminar()     -> se llama cuando la subida salió bien (por ejemplo, para recargar la lista)
export default function SubirImagen({ onSubir, alTerminar, texto = "Subir imagen", icono = <UploadOutlined />, tipo = "default", size }) {
  const { message } = App.useApp();
  const [subiendo, setSubiendo] = useState(false);

  const validar = (archivo) => {
    if (!TIPOS.includes(archivo.type)) {
      message.error("Elegí una imagen JPG, PNG o WebP.");
      return Upload.LIST_IGNORE;
    }
    if (archivo.size > MAXIMO_MB * 1024 * 1024) {
      message.error(`La imagen pesa más de ${MAXIMO_MB} MB.`);
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const subir = async ({ file, onSuccess, onError }) => {
    setSubiendo(true);
    try {
      await onSubir(file);
      onSuccess?.("ok");
      message.success("Imagen subida");
      await alTerminar?.();
    } catch (e) {
      onError?.(e);
      message.error(mensajeError(e, "No se pudo subir la imagen"));
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <Upload accept={TIPOS.join(",")} showUploadList={false} beforeUpload={validar} customRequest={subir} disabled={subiendo}>
      <Button type={tipo} size={size} icon={icono} loading={subiendo}>
        {texto}
      </Button>
    </Upload>
  );
}
