## 2026-09-12 - Missing dependencies and memoization overhead
**Learning:** Found an app where multiple expensive calculations (like Math.pow) are run redundantly within the render method during unrelated state updates. It is a React anti-pattern that leads to unnecessary computations.
**Action:** Add useMemo for performance critical functions invoked in JSX when working on a similar React frontend to ensure variables only recalculate when their dependencies change.
