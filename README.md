# Korpus

Cabinet ERP – https://korpus.vakysak.cz

## Stack

- Backend: Node.js + Express + Prisma
- DB: PostgreSQL (`korpus-db`)
- Import: CSV pipeline (`npm run import -- --supplier=demos --file=./data/demos.csv`)

## API v0.3

- `GET /health`
- `GET /api/suppliers|materials|hardware|prices|templates|customers|orders`
- `POST /api/customers`
- `POST /api/orders`
- `POST /api/orders/:id/items` (materialId + materialBackId + materialFrontId)
- `POST /api/orders/:id/bom` `{ "persist": true }`
- `GET /api/orders/:id/bom`

## Import

```bash
cd backend
npm run import -- --supplier=demos --file=./data/demos.csv
npm run import -- --supplier=trust --file=./data/trust.csv
npm run import -- --supplier=blum --file=./data/blum.csv
```
