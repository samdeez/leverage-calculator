## 2024-05-18 - Component Re-rendering in Tabbed Views
**Learning:** The application uses CSS `display: block/none` to toggle between the `Leverage` and `Spot` calculator tabs instead of unmounting them to preserve state. Since they are conditionally rendered together, they re-render on every tab switch because the parent `App` component state changes.
**Action:** Use `React.memo()` on purely static child components or those whose props don't change when their parent's state updates, especially if they are heavy computation components and kept mounted via CSS.
