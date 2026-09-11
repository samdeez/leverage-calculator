## 2024-05-24 - Tab Accessibility Pattern
**Learning:** The main navigation uses basic buttons instead of semantic tabs, which lack proper screen reader context (tablist, tab roles, aria-selected) and keyboard focus styles. The active tab also had a contrast issue (black text on darkslategray).
**Action:** When converting navigation buttons to tabs, always add full ARIA tablist/tab structure, ensure `color: whitesmoke` (or similar high-contrast) on dark active backgrounds, and explicitly add `focus-visible` styles since default browser outlines can be insufficient on custom buttons.
