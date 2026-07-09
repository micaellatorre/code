---
name: tech-stock-prisma
description: Plan, review, or implement TECH-STOCK Prisma schema, model relation, index, migration, tenant-scope, Decimal, and legacy-data changes. Use for Prisma/schema tasks; do not use for UI-only work.
---

# TECH-STOCK Prisma

Mandatory workflow:

1. Read the relevant complete schema section.
2. Identify inverse relations.
3. Identify ambiguous relation names.
4. Review legacy data implications.
5. Analyze nullability.
6. Analyze indexes.
7. Analyze unique constraints.
8. Analyze `onDelete`.
9. Review tenant scope.
10. Design non-destructive migration strategy.

Do not assume `prisma db push` is safe.

Never execute automatically:

- `prisma migrate reset`
- `DROP DATABASE`
- `TRUNCATE`
- destructive DDL

When adding a foreign key to historical data, prefer nullable DB field, mandatory validation for new writes, explicit backfill, validation, then future constraint when appropriate.

Run `npx prisma format` after schema edits. Do not add destructive UNIQUE constraints without inspecting duplicates.
