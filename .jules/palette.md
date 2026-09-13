## 2024-06-25 - Accessible Labels for Number Inputs
**Learning:** `react-number-format` inputs in this project's design pattern were incorrectly using `<div>` tags for labels, breaking screen reader form navigation. They require explicit `<label>` tags with matching `htmlFor`/`id` pairs for proper accessibility.
**Action:** Ensure all custom input components (like `<NumericFormat>`) are paired with a semantic `<label>` using the `htmlFor` attribute pointing to the input's `id`.
