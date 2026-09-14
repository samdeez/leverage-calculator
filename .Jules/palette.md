## 2026-09-14 - Semantic Labels for Custom Input Components
**Learning:** Third-party input components (like `react-number-format`) often lack native semantic labels when implemented with custom wrapping `<div>`s. Without explicitly pairing them using `<label htmlFor="...">` and `id="..."`, they remain completely inaccessible to screen reader users and prevent click-to-focus behavior.
**Action:** Always ensure that custom or third-party input components are explicitly paired with semantic `<label>` elements containing matching `id`s, avoiding generic `<div>` labels.
