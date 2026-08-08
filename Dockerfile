FROM node:22-alpine
WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
COPY backend/prisma ./prisma
RUN npm install --omit=dev \
  && npx prisma generate

COPY backend/ ./
RUN chmod +x docker-entrypoint.sh

ENV PORT=3000
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
