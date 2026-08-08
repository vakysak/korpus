# Korpus

Cabinet ERP (cloud-first) – https://korpus.vakysak.cz

## Stack

- Backend: Node.js + Express + Prisma
- DB: PostgreSQL (Coolify `korpus-db`)
- Frontend: React (připravuje se)

## Struktura

- `backend/` – API, Prisma schema, seed
- `frontend/` – React UI
- `db/` – odkaz na migrace
- `docs/` – logika, vzorce, pravidla

## API (v0.1)

- `GET /health`
- `GET /api/suppliers`
- `GET /api/materials`
- `GET /api/edges`
- `GET /api/hardware?type=hinge`
- `GET /api/templates`
- `GET|POST /api/orders`

## Lokální vývoj

```bash
cd backend
cp .env.example .env
# nastav DATABASE_URL
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```
