## 2025-05-18 - Avoid functions inside JSX evaluation during rendering
**Learning:** Functions invoked inside JSX (like `{compoundCalc()}`) get evaluated multiple times during rendering. Even worst, they get re-evaluated entirely when independent unrelated states (like `localPrice`) trigger a re-render.
**Action:** Always extract complex logic into `useMemo` hooks. This ensures calculations run only when dependencies change and are computed once per render.
