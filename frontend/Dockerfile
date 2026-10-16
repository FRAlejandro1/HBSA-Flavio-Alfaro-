# Imagen del frontend: compila la SPA y la sirve con nginx, que ademas termina el HTTPS
# y reenvia /api al backend. Se construye desde la RAIZ del repositorio:
#   docker build -f frontend/Dockerfile -t hbsa-frontend .

# --- 1. Compilar la aplicacion ---
FROM node:20.19.4-slim AS construccion
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace=frontend --ignore-scripts
COPY frontend frontend
# La API se sirve en el mismo dominio, bajo /api (las cookies seguras lo requieren)
ARG VITE_API_URL=/api
ARG VITE_APP_NOMBRE="Sistema de Vacaciones Hospitalarias"
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_NOMBRE=$VITE_APP_NOMBRE
RUN npm run build -w frontend

# --- 2. Servidor web sin privilegios (escucha en 8080 y 8443) ---
FROM nginxinc/nginx-unprivileged:1.27-alpine AS ejecucion
COPY frontend/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY frontend/nginx/seguridad.conf /etc/nginx/seguridad.conf
COPY --from=construccion /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080 8443
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
