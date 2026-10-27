#!/usr/bin/env bash
# Reconstruye y levanta todo (db, back, front) con los últimos cambios.
# Baja los contenedores viejos, borra sus imágenes, buildea imágenes nuevas
# y corre contenedores nuevos. El volumen de la base (db_data) se conserva.
set -euo pipefail

cd "$(dirname "$0")"

echo ">> Bajando contenedores e imágenes viejas..."
docker compose down --remove-orphans --rmi local

echo ">> Buildeando imágenes nuevas..."
docker compose build --pull

echo ">> Levantando contenedores nuevos..."
docker compose up -d

echo ">> Listo:"
docker compose ps
echo "   Front: http://localhost:8081  |  Back: http://localhost:3000  |  DB: volumen db_data"
