#!/usr/bin/env bash
# Crea la base (si no existe) y carga el esquema y los datos de prueba en el Postgres local.
# Usa la conexión del .env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).
# Es lo mismo que hacer a mano en pgAdmin 4: crear la base y ejecutar 00_schema.sql y 01_datos_prueba.sql.
#   ./database/cargar_base.sh           -> crea la base y la carga (si ya tiene tablas, no toca nada)
#   ./database/cargar_base.sh --reset   -> BORRA la base y la vuelve a crear (se pierden los datos)
#   ./database/cargar_base.sh --migrar  -> si ya tenés la base de una fase anterior: le aplica las fases nuevas
#                                          (database/00_schema_faseN.sql, se pueden repetir) sin tocar tus datos
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "Falta el archivo .env (copiá .env.example y completá DB_PASSWORD)"; exit 1; }
set -a; . ./.env; set +a
export PGPASSWORD="${DB_PASSWORD:-}"
[ -n "$PGPASSWORD" ] || { echo "Completá DB_PASSWORD en el .env con la contraseña de tu Postgres"; exit 1; }

PSQL=(psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" -v ON_ERROR_STOP=1 -q)

if [ "${1:-}" = "--migrar" ]; then
  for archivo in $(LC_ALL=C ls database/00_schema_fase*.sql); do
    echo ">> Aplicando $archivo..."
    "${PSQL[@]}" -d "$DB_NAME" -f "$archivo"
  done
  echo ">> Listo: la base $DB_NAME quedó al día."
  exit 0
fi

if [ "${1:-}" = "--reset" ]; then
  echo ">> Borrando la base $DB_NAME..."
  "${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE)"
fi

if [ -z "$("${PSQL[@]}" -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'")" ]; then
  echo ">> Creando la base $DB_NAME..."
  "${PSQL[@]}" -d postgres -c "CREATE DATABASE \"$DB_NAME\""
fi

if [ -n "$("${PSQL[@]}" -d "$DB_NAME" -Atc "SELECT to_regclass('public.boliche')")" ]; then
  echo ">> La base $DB_NAME ya tiene tablas: no se carga nada (usá --reset para empezar de cero)."
  exit 0
fi

# Orden fijo (el esquema base, las fases en orden y al final los datos), sin depender del idioma del sistema.
for archivo in $(cd database && LC_ALL=C ls 00_schema*.sql) 01_datos_prueba.sql; do
  echo ">> Ejecutando $archivo..."
  "${PSQL[@]}" -d "$DB_NAME" -f "database/$archivo"
done
echo ">> Listo. Podés verla en pgAdmin 4: Servers > local > Databases > $DB_NAME"
