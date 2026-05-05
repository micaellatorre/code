-- Model product reservations as fields instead of a ProductState enum value.
-- PostgreSQL cannot safely remove an enum value in place, so recreate ProductState.

ALTER TABLE "public"."Product"
  ADD COLUMN "senado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "senadoAt" TIMESTAMP(3);

UPDATE "public"."Product"
SET
  "senado" = true,
  "senadoAt" = COALESCE("updatedAt", NOW()),
  "state" = 'EN_STOCK'
WHERE "state" = 'SENADO';

CREATE TYPE "public"."ProductState_new" AS ENUM (
  'EN_STOCK',
  'EN_CAMINO',
  'EN_REPARACION',
  'CON_CLIENTE',
  'DISPONIBLE',
  'FUERA_DE_STOCK',
  'VENDIDO'
);

ALTER TABLE "public"."Product"
  ALTER COLUMN "state" DROP DEFAULT;

ALTER TABLE "public"."Product"
  ALTER COLUMN "state" TYPE "public"."ProductState_new"
  USING (
    CASE "state"::text
      WHEN 'DISPONIBLE_PARA_VENTA' THEN 'DISPONIBLE'
      ELSE "state"::text
    END::"public"."ProductState_new"
  );

DROP TYPE "public"."ProductState";

ALTER TYPE "public"."ProductState_new" RENAME TO "ProductState";

ALTER TABLE "public"."Product"
  ALTER COLUMN "state" SET DEFAULT 'EN_CAMINO';
