## 2026-09-23 - Missing HTTP Security Headers

**Vulnerability:** The application was deployed on Netlify without setting standard HTTP security headers (like Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, etc.), increasing the risk of XSS, clickjacking, and MIME-type sniffing.

**Learning:** Netlify relies on an explicit `_headers` file in the publish directory to configure HTTP headers. Since it's a Vite build, this file must be placed in the `public` directory so that it gets copied to the `build` output directory during the build process. A strict CSP must also account for Vite's/React's requirement for `'unsafe-inline'` styles and scripts, as well as external dependencies like Google Fonts.

**Prevention:** Always create a `public/_headers` file when deploying to Netlify to explicitly define security headers. Test CSP locally to ensure external resources (like fonts) and inline scripts/styles required by the framework are correctly allow-listed.
