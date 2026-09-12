## 2024-05-24 - Custom Tabs Accessibility and Contrast in Leverage Calculator
**Learning:** The custom toggle buttons serving as tabs lacked proper ARIA roles (`tablist`, `tab`, `tabpanel`) making them opaque to screen readers. In addition, the active state background color (`darkslategray`) had insufficient contrast with the default black text.
**Action:** Implemented semantic tab roles and states, ensured high contrast (`whitesmoke` text) for active items, and added visible focus indicators for keyboard accessibility matching existing form input styles.
