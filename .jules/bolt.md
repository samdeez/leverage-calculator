## 2024-10-24 - React.memo for CSS-toggled Tabs
**Learning:** The application conditionally hides the main components (`Leverage` and `Spot`) using CSS `display: block/none` rather than dynamically unmounting them, intentionally preserving user input state when switching tabs. This causes both heavy components to re-render on every tab switch.
**Action:** Wrap child components in `React.memo()` when their visibility is controlled by the parent component's state via CSS toggling, as they don't receive new props and shouldn't re-render.
