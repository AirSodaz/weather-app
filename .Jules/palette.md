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

## 2026-03-22 - Focus Visible Verification
**Learning:** Programmatic focus (e.g. `element.focus()`) often fails to trigger `:focus-visible` styles in headless browsers.
**Action:** Always simulate real keyboard events (like `page.keyboard.press("Tab")`) when verifying focus indicators in Playwright tests.

## 2026-06-15 - Transient Deletion Confirmation
**Learning:** Destructive actions (like deleting a city) in transient menus (context menus) risk accidental triggers if executed immediately. A modal is too heavy for such frequent actions.
**Action:** Implement a two-step confirmation pattern directly within the menu item (e.g., "Remove" -> "Confirm?"), using state to track the pending confirmation before executing.

## 2026-02-05 - Glassmorphism Focus Consistency
**Learning:** Default browser focus rings or subtle border color changes are insufficient on glassmorphism backgrounds (dark, semi-transparent). High contrast rings (e.g. `ring-white/50`) are necessary for visibility.
**Action:** Standardize all interactive elements (Inputs, Select triggers, Icon buttons) to use `focus-visible:ring-2 focus-visible:ring-white/50` for consistent accessibility.

## 2026-02-08 - Nested Focus Visibility
**Learning:** Icon-only buttons (like "Clear search") often lack sufficient visual affordance for keyboard users if they rely on parent `focus-within` styles, making it hard to distinguish which specific element is focused.
**Action:** Always add explicit `focus-visible` styles to nested interactive elements, even if the container has focus styles.

## 2026-02-10 - Ambiguous Action Buttons in Lists
**Learning:** Repetitive "More actions" buttons in list items (like weather cards) confuse screen reader users by lacking context about which item they control.
**Action:** Always include the item's unique identifier (e.g., city name) in the `aria-label` (e.g., "More actions for London") to distinguish identical controls.
