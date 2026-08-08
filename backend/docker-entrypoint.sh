#!/bin/sh
set -e
echo "Running migrations..."
npx prisma migrate deploy
echo "Seeding (idempotent)..."
node prisma/seed.js || true
echo "Starting API..."
exec node src/index.js
