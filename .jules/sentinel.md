## 2024-05-24 - Missing Security Headers in Netlify Deployment
**Vulnerability:** The Netlify deployment is missing critical HTTP security headers (CSP, X-Frame-Options, etc.).
**Learning:** React/Vite SPAs don't automatically set security headers; they must be explicitly configured for the hosting platform. In Netlify, this is done via a `_headers` file in the `public` directory, which gets copied to the build output.
**Prevention:** Always ensure a `_headers` file with strict security configurations is present in the `public` directory when deploying static sites.
