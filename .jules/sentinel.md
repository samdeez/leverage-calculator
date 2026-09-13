## 2024-05-18 - Missing Security Headers in Static Build
**Vulnerability:** The Netlify static deployment was missing basic HTTP security headers (X-Frame-Options, X-Content-Type-Options, etc.), making it susceptible to clickjacking and MIME-type sniffing.
**Learning:** Static React builds on platforms like Netlify require explicit configuration files (like `_headers`) to add security headers. They aren't added by default.
**Prevention:** Always create a `_headers` or equivalent configuration file for static deployments to enforce baseline HTTP security policies.
