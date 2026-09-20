## 2024-05-24 - Unnecessary re-renders when toggling visibility
**Learning:** In React, toggling visibility with CSS `display` state in a parent component causes child components to re-render even if they receive no props, unless they are memoized.
**Action:** Wrap child components whose visibility is toggled via CSS with `React.memo()` to prevent expensive re-renders.
