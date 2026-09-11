## 2026-09-11 - [Add Security Headers]
**Vulnerability:** Missing security headers (defense in depth)
**Learning:** For a static React app on Netlify, adding a `_headers` file in `public` is an easy way to enable HTTP security headers.
**Prevention:** Always ensure standard security headers (CSP, X-Frame-Options, HSTS, etc.) are present in new static site deployments.
