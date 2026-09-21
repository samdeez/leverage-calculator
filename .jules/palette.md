## 2025-01-24 - Form inputs lacked semantic labels
**Learning:** `react-number-format` components like `<NumericFormat>` were grouped with regular `<div>` tags acting as visual labels. While this works visually, it breaks screen reader form navigation and general accessibility guidelines.
**Action:** Always ensure that form inputs are properly associated with semantic `<label htmlFor="...">` tags and that the input itself accepts an `id` that matches the label's `htmlFor` attribute.
