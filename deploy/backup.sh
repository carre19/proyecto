#!/usr/bin/env bash
# Copia de seguridad de la base y de las imágenes subidas. Correrlo todos los días (cron) desde la raíz del proyecto:
#   0 4 * * * cd /opt/plataforma && ./deploy/backup.sh >> /var/log/plataforma-backup.log 2>&1
# Guarda los últimos 14 días en ./backups. Copiá esa carpeta también fuera del servidor.
set -euo pipefail
cd "$(dirname "$0")/.."
COMPOSE=(docker compose -f deploy/docker-compose.prod.yml --env-file .env)
DESTINO=backups; mkdir -p "$DESTINO"; FECHA=$(date +%Y-%m-%d_%H%M)

"${COMPOSE[@]}" exec -T db pg_dump -U plataforma -d plataforma --no-owner | gzip > "$DESTINO/base_$FECHA.sql.gz"
"${COMPOSE[@]}" exec -T back tar -C /app -czf - uploads > "$DESTINO/imagenes_$FECHA.tar.gz"
find "$DESTINO" -type f -mtime +14 -delete
echo "Copia lista: $DESTINO/base_$FECHA.sql.gz y $DESTINO/imagenes_$FECHA.tar.gz"
