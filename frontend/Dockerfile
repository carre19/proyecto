FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Dominio de la plataforma (cada boliche vive en un subdominio). Vacío = las páginas se ven en /b/:subdominio.
ARG VITE_DOMINIO_BASE=""
ENV VITE_DOMINIO_BASE=$VITE_DOMINIO_BASE
RUN npm run build

FROM nginx:alpine
# Qué configuración de nginx usar: nginx.conf (HTTP, para desarrollo y demostración) o nginx-https.conf (producción, ver docs/DESPLIEGUE.md).
ARG NGINX_CONF=nginx.conf
COPY ${NGINX_CONF} /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 443
