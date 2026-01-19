## 2024-05-23 - React Event Handler Memoization
**Learning:** In React components with heavy children (like lists), even if children are memoized with `React.memo`, passing event handlers that depend on frequent state changes (like drag indices) breaks memoization.
**Action:** Use `useRef` to store mutable state accessed in callbacks (e.g. `draggedIndexRef`) to keep handler references stable and prevent unnecessary re-renders of all list items.
