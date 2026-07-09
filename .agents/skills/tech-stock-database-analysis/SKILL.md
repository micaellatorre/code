---
name: tech-stock-database-analysis
description: Analyze TECH-STOCK PostgreSQL/Prisma data in read-only mode for schema inspection, SELECTs, counts, inconsistencies, migration validation, relationship analysis, and legacy data review. Use for database analysis; do not use for application UI-only tasks or write migrations unless explicitly requested.
---

# TECH-STOCK Database Analysis

Default mode is read-only.

Allowed by default:

- `SELECT`
- `WITH`
- `EXPLAIN` without `ANALYZE` when effects or cost are uncertain
- Read-only catalog queries

Before querying:

1. Identify the exact Prisma model and Postgres table.
2. Respect quoted case-sensitive names.
3. Limit inspected rows.
4. Prefer `COUNT`, `GROUP BY` and `DISTINCT` for large analysis.
5. Never print `DATABASE_URL`.

Prohibited by default:

- `INSERT`
- `UPDATE`
- `DELETE`
- `UPSERT`
- `ALTER`
- `DROP`
- `TRUNCATE`
- `CREATE`
- `GRANT`
- `REVOKE`
- Prisma migrations

When PostgreSQL MCP read-only access is available, use it for inspection. Otherwise use local safe tools such as Prisma scripts or `psql` only with read-only SQL and without echoing credentials.

If the user explicitly asks for SQL migration work, explain impact, include validation query before, transaction when appropriate, and verification query after.
