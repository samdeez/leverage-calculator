## 2024-09-24 - Missing Security Headers in Netlify Deployment

**Vulnerability:** The application was missing basic security HTTP headers such as X-Frame-Options, X-Content-Type-Options, and Referrer-Policy, leaving it susceptible to attacks like clickjacking and MIME sniffing.
**Learning:** Netlify deployments for static Vite/React apps require a `public/_headers` file to configure these headers. Avoid blindly applying highly restrictive Content-Security-Policy (CSP) headers without verifying the application's external dependencies (e.g., web fonts, APIs, third-party images), as it risks breaking core functionality.
**Prevention:** Always ensure a `_headers` file is included in the `public` directory for Netlify deployments with a secure baseline configuration.
