# TECH-STOCK Engineering Instructions

## Project context

TECH-STOCK es una aplicacion multi-tenant de gestion para retail de tecnologia de GP Importaciones.

Dominios principales: auth / RBAC, branches, products / inventory, suppliers, purchases, buyers, appointments, reservations, sales, payments, cash, commissions, service orders, trade-in y audit.

## Architecture

- Next.js App Router, React, TypeScript, Prisma, PostgreSQL y Tailwind CSS.
- Componentes React organizados por dominio en `src/components`.
- UI instalada: Headless UI, Heroicons, Remix Icon, Tremor, DaisyUI y utilidades Tailwind.
- Validacion instalada: Zod. No asumir React Hook Form, Radix o shadcn si no aparecen en `package.json`.
- Package manager: npm (`package-lock.json`).

## Repository-first workflow

Antes de implementar:

1. Inspeccionar codigo existente.
2. Localizar componente, helper o dominio equivalente.
3. Reutilizar patrones existentes.
4. Revisar `prisma/schema.prisma`.
5. Revisar guards de autorizacion.
6. Revisar `tenantId`.
7. Revisar branch context.
8. Revisar timezone.
9. Revisar `Prisma.Decimal`.

No crear arquitecturas paralelas.

## TypeScript

- No usar `any`.
- Evitar casts inseguros.
- Usar DTOs explicitos.
- Distinguir Server Components y Client Components.
- No filtrar `Prisma.Decimal` directamente a Client Components; serializarlo.

## Prisma / tenant

Toda entidad tenant-scoped debe validar `tenantId`.

Nunca confiar en IDs enviados por cliente para inferir tenant. Evitar `findUnique({ where: { id } })` seguido de asumir pertenencia tenant; validar tenant explicitamente con `findFirst` o filtros equivalentes.

## Authorization

Reutilizar helpers reales:

- `requireRoleApi`
- `requireRolePage`

Permisos backend son obligatorios. Ocultar botones no reemplaza autorizacion de API.

Respetar `activeRole` y simulacion ADMIN. Cuando corresponda, registrar actor real ADMIN, rol simulado y `executedByAdminInSimulation`.

## Money

`Prisma.Decimal` es la fuente de verdad del backend.

No usar floats JS como fuente final de calculos financieros. El servidor recalcula subtotales, costos, profit, `amountUsd`, balances y commissions.

No sumar monedas distintas directamente. Normalizar pagos con `amountUsd` cuando el dominio lo requiera.

## Dates

Respetar `America/Argentina/Buenos_Aires` y utilidades existentes en `src/lib/timezone.ts`.

Evitar parsear `YYYY-MM-DD` como UTC cuando representa fecha local.

## UX/UI

- Seguir el design system existente.
- Reducir carga cognitiva y priorizar jerarquia visual.
- Mantener densidad coherente en tablas operativas.
- Usar progressive disclosure.
- Usar modales/drawers para detalle contextual cuando sea mejor que navegar.
- Mantener filtros cerca del listado que afectan.
- Colocar acciones de fila al final.
- Usar tooltips y `aria-label` en icon buttons.
- Cubrir estados loading, empty, error y success.
- Validar responsive real y evitar overflow accidental.
- No inventar un nuevo theme.
- Reutilizar Heroicons cuando sea la libreria adecuada.

## Validation

Despues de cambios relevantes:

- Ejecutar `npm run lint`.
- Ejecutar `npm run build` solo cuando el cambio lo justifique.
- Ejecutar `git diff --check`.
- Revisar `git diff`.

Para cambios UX importantes, usar browser/Playwright MCP cuando este disponible.

## Database safety

Las tareas normales de analisis de DB son read-only.

No ejecutar escrituras, DDL, migraciones Prisma, `DROP`, `TRUNCATE`, `ALTER`, `UPDATE`, `INSERT` o `DELETE` salvo instruccion explicita del usuario en la tarea actual.

Nunca imprimir ni versionar `DATABASE_URL`, API keys, tokens o credenciales.
