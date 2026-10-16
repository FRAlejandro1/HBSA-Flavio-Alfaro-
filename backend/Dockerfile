# Imagen del backend (API). Se construye desde la RAIZ del repositorio:
#   docker build -f backend/Dockerfile -t hbsa-backend .
# Tres etapas: compilar, instalar solo las dependencias de produccion y armar la imagen final,
# que no lleva compilador ni dependencias de desarrollo.

# --- 1. Compilar TypeScript ---
FROM node:20.19.4-slim AS construccion
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
# El frontend no se construye aqui, pero npm exige que existan todos los paquetes del monorepo
COPY frontend/package.json frontend/package.json
# Sin scripts: el "prepare" del monorepo instala los hooks de git, que aqui no existen
RUN npm ci --workspace=backend --ignore-scripts
COPY backend backend
RUN npm run build -w backend

# --- 2. Dependencias de produccion ---
FROM node:20.19.4-slim AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace=backend --omit=dev --ignore-scripts && npm cache clean --force

# --- 3. Imagen final ---
FROM node:20.19.4-slim AS ejecucion
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencias --chown=node:node /app/ ./
COPY --from=construccion --chown=node:node /app/backend/dist ./backend/dist
# Migraciones y seeds: los usa el comando de migracion (dist/scripts/migrar.js)
COPY --chown=node:node database ./database

# Falla ahora, y no en el servidor, si la libreria de claves (Argon2) no carga en esta imagen
RUN node -e "require('argon2'); console.log('argon2 cargado')"

# Carpeta de los PDF generados; en el servidor es un volumen
RUN mkdir -p backend/storage && chown node:node backend/storage

USER node
WORKDIR /app/backend
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/salud').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/server.js"]
