---
name: tech-stock-ui-implementation
description: Implement or redesign TECH-STOCK UI components while preserving the existing design language, accessibility, responsive behavior, Heroicons usage, and domain workflows. Use for UI implementation tasks; do not use for backend-only or database-only changes.
---

# TECH-STOCK UI Implementation

Before editing UI:

1. Inspect neighboring components and pages in the same domain.
2. Identify existing spacing, radius, borders, shadows, typography, table density and button patterns.
3. Reuse existing components and utilities before adding new abstractions.
4. Confirm whether dark mode exists before adding dark-mode work.

Implementation rules:

- Preserve semantic HTML and accessibility.
- Avoid div soup.
- Avoid generic abstractions used only once.
- Reuse Heroicons for icon buttons when suitable.
- Add tooltips and `aria-label` to icon-only buttons.
- Preserve disabled, loading and error states.
- Avoid layout shift with stable dimensions and responsive constraints.
- Keep destructive actions visually secondary.

When the user provides an image or Figma reference and Figma MCP is available, inspect frames/components first. Extract the UX pattern, spacing and hierarchy; do not copy unrelated branding. Adapt the result to TECH-STOCK's existing UI.
