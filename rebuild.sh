#!/usr/bin/env bash
# Reconstruye y levanta la demostración con Docker (db, back, front) con los últimos cambios.
# Conserva los volúmenes (la base y las imágenes). Para PRODUCCIÓN ver docs/DESPLIEGUE.md.
set -euo pipefail

cd "$(dirname "$0")"

echo ">> Bajando contenedores viejos..."
docker compose down --remove-orphans

echo ">> Construyendo las imágenes nuevas..."
docker compose build --pull

echo ">> Levantando..."
docker compose up -d

echo ">> Listo:"
docker compose ps
echo "   Front: http://localhost:8081  |  Back: http://localhost:3000"
