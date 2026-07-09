---
name: tech-stock-forms
description: Create, audit, or improve TECH-STOCK operational forms, quick-create flows, validation states, dependent selectors, submit behavior, and buyer forms. Use for form UX/UI implementation; do not use for table-only or backend-only work.
---

# TECH-STOCK Forms

Form rules:

- Distinguish full creation from quick creation.
- Do not expose every model field by default.
- Group fields into semantic sections.
- Use visible labels; do not replace labels with placeholders.
- Mark required fields with `*`.
- Use helper text only when it helps the workflow.
- Show inline validation near the field.
- Preserve user input after API errors.
- Disable submit while loading and prevent double submit.
- Use autofocus only when it improves the workflow.
- Clear invalid dependent selector values when the parent changes.

Buyer quick-create rules:

MINORISTA required fields: `name`, `surname`, `dni`.

MINORISTA optional fields: `phone`, `email`, `instagram`.

MAYORISTA required fields: `name`, `surname`, `businessName`, `cuit`.

MAYORISTA optional fields: `phone`, `email`, `instagram`.

When the buyer type comes from screen context, do not ask for it again unless the workflow needs an override.
