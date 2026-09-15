## 2025-02-14 - Semantic labels for `react-number-format`
**Learning:** `react-number-format`'s `<NumericFormat>` component requires proper semantic `<label htmlFor="...">` pairing and explicit `id` attributes for screen reader accessibility, as using custom `<div>` tags for labels breaks keyboard navigation and screen reader form association.
**Action:** Always ensure that `react-number-format` inputs in this app are paired with a semantic `<label>` using matching `htmlFor` and `id` properties instead of relying on `<div>` wrappers.
