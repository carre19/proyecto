FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
EXPOSE 3000

# Las imágenes subidas van a un volumen (UPLOADS_DIR), para que no se pierdan al actualizar el servidor.
RUN mkdir -p /app/uploads && chown node:node /app/uploads
VOLUME /app/uploads
USER node

CMD ["node", "src/index.js"]
