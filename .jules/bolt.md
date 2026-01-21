## 2026-01-20 - Parallelize Independent API Requests
**Learning:** Sequential API calls that don't depend on each other's data (like Forecast and History, or Weather and Forecast) should be parallelized using `Promise.all` to reduce total latency.
**Action:** Always check if subsequent API calls rely on data from previous ones. If not, fire them concurrently. For optional calls, handle rejections individually so `Promise.all` doesn't fail the entire batch.

## 2026-01-20 - Isolate Frequent Updates
**Learning:** Frequent state updates (like minute-by-minute timers) in large parent components cause expensive re-renders of the entire tree.
**Action:** Move such timers into small, dedicated leaf components (e.g., `<RelativeTime />`) so only the text updates, not the whole dashboard.
