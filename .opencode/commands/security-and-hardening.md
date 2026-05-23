# Security and Hardening

Security-first development practices. Treat every external input as hostile, every secret as sacred, and every authorization check as mandatory.

## When to Use

- Building anything that accepts user input
- Implementing authentication or authorization
- Storing or transmitting sensitive data
- Integrating with external APIs or services
- Adding file uploads, webhooks, or callbacks
- Handling payment or PII data

## Three-Tier Boundary System

### Always Do (No Exceptions)
- Validate all external input at the system boundary
- Parameterize all database queries
- Encode output to prevent XSS
- Use HTTPS for all external communication
- Hash passwords with bcrypt/scrypt/argon2
- Set security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- Use httpOnly, secure, sameSite cookies for sessions
- Run `npm audit` before every release

### Ask First (Requires Human Approval)
- Adding new authentication flows or changing auth logic
- Storing new categories of sensitive data
- Adding new external service integrations
- Changing CORS configuration
- Adding file upload handlers
- Modifying rate limiting or throttling

### Never Do
- Never commit secrets to version control
- Never log sensitive data
- Never trust client-side validation as a security boundary
- Never disable security headers for convenience
- Never use `eval()` or `innerHTML` with user-provided data
- Never store sessions in client-accessible storage

## OWASP Top 10 Prevention

- **Injection** — Parameterized queries, ORM with parameterized input
- **Broken Authentication** — Password hashing, secure session management
- **XSS** — Framework auto-escaping, DOMPurify for raw HTML
- **Broken Access Control** — Check authorization on every endpoint, not just authentication
- **Security Misconfiguration** — Helmet, CSP, restricted CORS

## Trigger

"Secure this: [feature/code]"
"Review security for: [description]"
"Apply security hardening to: [code]"

## Output

Security-reviewed code with input validation, parameterized queries, proper auth checks, security headers, and no secrets in source.
