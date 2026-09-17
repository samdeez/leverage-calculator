## 2026-09-17 - [Missing Security Headers in Netlify Deployment]
**Vulnerability:** The application was deployed on Netlify without setting security headers like Content-Security-Policy (CSP), X-Frame-Options, X-Content-Type-Options, and Referrer-Policy, leaving the application vulnerable to Clickjacking, XSS, and MIME-sniffing attacks.
**Learning:** For static sites deployed via Netlify (such as Vite + React), HTTP headers are not managed within the application code itself but rather through a `_headers` file in the `public` directory.
**Prevention:** Always ensure a `_headers` file is added to static sites with basic security headers in place, considering required external resources such as Google Fonts (`fonts.googleapis.com` and `fonts.gstatic.com`).
