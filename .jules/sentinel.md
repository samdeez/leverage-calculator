## 2024-05-15 - [Added Netlify Security Headers and Configured CSP]
**Vulnerability:** Missing HTTP security headers (e.g., CSP, X-Frame-Options) allowed for potential clickjacking, cross-site scripting (XSS), and data injection attacks.
**Learning:** The application requires specific external dependencies (Google Fonts APIs: fonts.googleapis.com and fonts.gstatic.com) and requires 'unsafe-inline' for scripts and styles due to Vite's build process. Blindly applying a restrictive CSP breaks core styling and functionality.
**Prevention:** Future modifications to the Content-Security-Policy must explicitly allow these required domains and Vite's 'unsafe-inline' requirements to prevent regressions. Always test the production build (`pnpm build` and preview) after modifying headers.
