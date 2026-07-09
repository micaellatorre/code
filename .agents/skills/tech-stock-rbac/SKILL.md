---
name: tech-stock-rbac
description: Review or implement TECH-STOCK roles, authorization guards, activeRole behavior, ADMIN simulation, tenant checks, field-level visibility, and backend API permissions. Use for RBAC/security access-control work; do not use for visual-only changes.
---

# TECH-STOCK RBAC

Roles:

- `ADMIN`
- `VENDEDOR`
- `STOCK`
- `SOCIO`

Workflow:

1. Identify the actor and `activeRole`.
2. Review `requireRolePage`.
3. Review `requireRoleApi`.
4. Review active role simulation behavior.
5. Review tenant scope.
6. Review field-level visibility.
7. Review direct API mutation paths.

Rules:

- Hiding UI is not authorization.
- Backend validation is required.
- Do not elevate STOCK or VENDEDOR for implementation convenience.
- For ADMIN simulation, preserve actor real ADMIN, active/simulated role, and `executedByAdminInSimulation` where the domain logs it.
