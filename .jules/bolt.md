## 2024-09-11 - [React Component Re-renders on State Change]
**Learning:** Re-evaluating components hidden by CSS `display: none` causes unnecessary computations on each parent re-render. A prior attempt to replace this with conditional rendering caused a state reset issue (data loss) when the components unmounted.
**Action:** When trying to prevent unnecessary calculations in components that must remain mounted to preserve state, use `React.memo` to stop re-renders based on parent updates rather than unmounting them.
