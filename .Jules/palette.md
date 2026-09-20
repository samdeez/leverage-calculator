## 2024-05-18 - Semantic Labels with react-number-format
**Learning:** `react-number-format` successfully passes standard HTML attributes (like `id`) down to the underlying `<input>` element correctly. This makes it easy to enforce semantic `<label htmlFor="...">` pairings across components using `react-number-format` for proper screen reader form navigation and accessibility.
**Action:** Always ensure that `react-number-format` `<NumericFormat>` components are paired with semantic `<label>` elements using matching `htmlFor` and `id` pairs.
