## 2024-10-24 - [Netlify Security Headers]
**Vulnerability:** Missing default HTTP security headers.
**Learning:** Netlify relies on `_headers` or `netlify.toml` for header configuration; Vite seamlessly copies `public/_headers` to the `build` directory.
**Prevention:** Ensure new static deployments always include a `public/_headers` file containing baseline HTTP security directives (e.g., CSP, X-Frame-Options).
