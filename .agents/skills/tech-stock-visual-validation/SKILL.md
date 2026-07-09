---
name: tech-stock-visual-validation
description: Validate TECH-STOCK UI changes in the running application using browser/Playwright tools. Use after significant table, form, modal, responsive, or workflow changes; do not use for backend-only changes.
---

# TECH-STOCK Visual Validation

Use this skill after meaningful UI changes.

Workflow:

1. Identify affected routes.
2. Detect the local URL instead of assuming port 3000.
3. Inspect `package.json` scripts.
4. Check whether the server is already available.
5. If needed and permitted, start the appropriate dev script.
6. Open the screen with browser/Playwright MCP when available.
7. Review desktop, intermediate and mobile viewports when supported.
8. Check console errors, horizontal overflow, clipped elements, viewport-fitting modals, sticky headers, tables, focus, disabled state, loading, empty and error states.
9. Capture screenshots when they provide evidence.
10. Compare against a visual reference when one exists.
11. Fix issues and repeat validation.

Do not declare UX complete without inspecting the real screen when browser automation is available.
