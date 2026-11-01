# ---- Etapa 1: build (compila TypeScript -> dist/) ----
FROM node:20-alpine AS build
WORKDIR /app

# Instala TODAS las dependencias (incl. dev) para poder compilar.
COPY package.json package-lock.json ./
RUN npm ci

# Copia el código y compila.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Etapa 2: runtime (imagen liviana, solo dependencias de producción) ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Solo dependencias de producción (sin TypeScript ni tipos).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copia el JS ya compilado desde la etapa de build.
COPY --from=build /app/dist ./dist

# Informativo: Railway inyecta el puerto real en process.env.PORT.
EXPOSE 4000

# Arranque del servidor. Railway usa este CMD (no hace falta Start command).
CMD ["node", "dist/index.js"]
