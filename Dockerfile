FROM node:22-alpine
WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev

COPY backend/ ./
RUN chmod +x docker-entrypoint.sh \
  && npx prisma generate

ENV PORT=3000
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
