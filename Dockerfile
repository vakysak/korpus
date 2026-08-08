FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
COPY backend/prisma ./prisma
RUN npm install --omit=dev \
  && npx prisma generate

COPY backend/ ./
COPY --from=frontend /frontend/dist ./public
RUN chmod +x docker-entrypoint.sh \
  && mkdir -p tmp/uploads

ENV PORT=3000
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
