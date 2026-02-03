## 2024-05-21 - Settings Modal Accessibility Gaps
**Learning:** Common form inputs (like API Keys and Custom URLs) were implemented as label/input siblings without programmatic association, rendering them inaccessible to screen readers.
**Action:** Always verify `htmlFor` and `id` pairings on custom form components, and use `aria-describedby` for help text to ensure context is preserved.

## 2024-05-22 - Toggle Group Accessibility
**Learning:** Custom button groups used for settings (like Language or Startup View) relied solely on visual cues (background color) for the selected state, leaving screen reader users unaware of the current selection.
**Action:** Always apply `aria-pressed` (or `aria-checked` within a radiogroup) to custom selection buttons to programmatically communicate the active state.

## 2024-05-23 - API Key Visibility
**Learning:** Hiding API keys by default prevents shoulder surfing but increases user error rates during entry. A hardcoded password type offers no fallback for verification.
**Action:** Implement a visibility toggle for complex input strings (like API keys) to balance security with usability, ensuring the toggle button has a dynamic `aria-label`.

## 2025-02-20 - Custom Select Label Association
**Learning:** The custom `Select` component rendered a visual label but failed to associate it programmatically with the trigger button, leaving screen reader users without context for the setting.
**Action:** Use `React.useId` to generate unique identifiers and link custom form controls to their labels using `htmlFor` and `id` attributes.

## 2026-02-03 - Modal Focus Management
**Learning:** Modals (`SettingsModal`) lacked focus trapping and Escape key support, allowing users to interact with the background and get lost.
**Action:** Use a `useFocusTrap` hook for all modal components to ensure focus stays contained and standard keyboard shortcuts (Escape) work.
