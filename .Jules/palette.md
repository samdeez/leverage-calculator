## 2024-05-24 - Semantic Form Labels with react-number-format
**Learning:** `react-number-format` components in this codebase pass standard HTML attributes (like `id`) down to the underlying `<input>` element correctly.
**Action:** Always pair `<NumericFormat>` components with semantic `<label htmlFor="...">` elements rather than `<div>` tags to ensure proper screen reader support and click-to-focus behavior.
