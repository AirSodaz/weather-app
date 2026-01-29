## 2024-05-21 - Settings Modal Accessibility Gaps
**Learning:** Common form inputs (like API Keys and Custom URLs) were implemented as label/input siblings without programmatic association, rendering them inaccessible to screen readers.
**Action:** Always verify `htmlFor` and `id` pairings on custom form components, and use `aria-describedby` for help text to ensure context is preserved.
