# Code – Next.js + Prisma

## Requisitos
- Node 20+
- PNPM o NPM
- Postgres (Neon/Railway)

## Setup
1. Copiar `.env.example` a `.env` y completar `DATABASE_URL`.
2. `pnpm i`
3. `pnpm prisma migrate dev`
4. (Opcional) `pnpm prisma db seed`
5. `pnpm dev`

## Scripts
- `dev`: arranca Next.js
- `build` / `start`
- `prisma:*`: migrate, generate, studio
