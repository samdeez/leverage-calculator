## 2023-10-27 - Missing Security Headers in Netlify Deployment
**Vulnerability:** The application was missing basic security HTTP headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Strict-Transport-Security) because Vite doesn't generate them natively.
**Learning:** For a React/Vite app deployed on Netlify, security headers must be configured by placing a `_headers` file in the `public/` directory so it's copied to the build output. Simply adding them in index.html as meta tags is insufficient for full coverage and not supported for headers like X-Frame-Options.
**Prevention:** Include a `public/_headers` file with baseline security header configurations for any future Netlify deployment to ensure defense against clickjacking and MIME-sniffing by default.
