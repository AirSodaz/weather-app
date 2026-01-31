## 2024-05-21 - Settings Modal Accessibility Gaps
**Learning:** Common form inputs (like API Keys and Custom URLs) were implemented as label/input siblings without programmatic association, rendering them inaccessible to screen readers.
**Action:** Always verify `htmlFor` and `id` pairings on custom form components, and use `aria-describedby` for help text to ensure context is preserved.

## 2024-05-22 - Toggle Group Accessibility
**Learning:** Custom button groups used for settings (like Language or Startup View) relied solely on visual cues (background color) for the selected state, leaving screen reader users unaware of the current selection.
**Action:** Always apply `aria-pressed` (or `aria-checked` within a radiogroup) to custom selection buttons to programmatically communicate the active state.
