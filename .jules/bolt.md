## 2026-01-20 - Parallelize Independent API Requests
**Learning:** Sequential API calls that don't depend on each other's data (like Forecast and History, or Weather and Forecast) should be parallelized using `Promise.all` to reduce total latency.
**Action:** Always check if subsequent API calls rely on data from previous ones. If not, fire them concurrently. For optional calls, handle rejections individually so `Promise.all` doesn't fail the entire batch.

## 2026-01-20 - Isolate Frequent Updates
**Learning:** Frequent state updates (like minute-by-minute timers) in large parent components cause expensive re-renders of the entire tree.
**Action:** Move such timers into small, dedicated leaf components (e.g., `<RelativeTime />`) so only the text updates, not the whole dashboard.

## 2026-01-22 - Direct DOM for Scroll Animations
**Learning:** Storing style values in React state during scroll events causes expensive re-renders on every frame.
**Action:** Use direct DOM manipulation (via refs) for high-frequency style updates like scroll-linked animations.

## 2026-01-22 - Avoid Premature useLatest Optimization
**Learning:** Using `useRef` to stabilize callbacks adds complexity and is often unnecessary if dependencies are naturally stable during critical paths (e.g., drag start index doesn't change during drag).
**Action:** Verify dependency instability during interaction before optimizing.

## 2026-01-22 - Scroll Verification with Empty States
**Learning:** When verifying scroll behaviors with Playwright in empty or loading states, the container may not be scrollable.
**Action:** Explicitly inject a spacer element (e.g., `minHeight = '2000px'`) into the scroll container to ensure scroll events can be triggered.

## 2026-01-22 - Playwright Evaluate Syntax
**Learning:** Python Playwright's `evaluate` method requires a function wrapper (e.g., `() => { ... }`) if the string argument contains a `return` statement.
**Action:** Always wrap multi-line scripts with return statements in an arrow function string when using `page.evaluate`.

## 2026-01-23 - Parallelize QWeather Requests
**Learning:** QWeather API endpoints accept `lon,lat` directly, allowing the initial City Lookup (for ID) to be parallelized with data requests when coordinates are known.
**Action:** When refactoring API logic, verify if "dependent" requests actually require the output of the previous step or if they can be fired concurrently using available inputs.

## 2026-01-23 - Memoize SortableContext Items
**Learning:** Passing a derived array to `SortableContext` (e.g., `list.map(...)`) creates a new reference on every render, forcing dnd-kit to update context and re-evaluate consumers.
**Action:** Use `useMemo` to stabilize the `items` array passed to `SortableContext` to prevent unnecessary re-renders during unrelated parent updates.

## 2026-02-05 - Cache Worker-Based Storage Reads
**Learning:** `storage.get` uses a web worker for parsing, which is safer but adds message-passing overhead. Frequent reads (e.g., in search debouncing or concurrent fetches) can saturate the worker and block.
**Action:** Implement in-memory caching and request deduplication (Promise reuse) for frequently accessed, read-heavy configuration data.
