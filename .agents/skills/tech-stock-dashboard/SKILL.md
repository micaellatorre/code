---
name: tech-stock-dashboard
description: Design, audit, or refactor TECH-STOCK dashboards, role-based KPI views, charts, financial summaries, alerts, and operational overview pages. Use for dashboard UX/data presentation work; do not use for isolated backend-only tasks.
---

# TECH-STOCK Dashboard

Start by identifying `activeRole`.

ADMIN dashboards can show revenue, gross profit, net profit when available, inventory valuation, cash, alerts, seller performance and stock aging.

VENDEDOR dashboards prioritize today's appointments, own sales, reservations, availability and pending leads.

STOCK dashboards prioritize inventory, in-transit items, repair/review items, aging and inconsistencies.

SOCIO dashboards are read-oriented and can show permitted financial KPIs without mutative actions.

Rules:

- Every KPI must answer a concrete question.
- Do not add decorative cards.
- Delta needs a comparable period.
- Do not mix currencies.
- Use charts only for trends, composition or comparison.
- Prefer tables when precision is required.
- Keep period filters persistent.
- Do not hide critical calculation methodology.
