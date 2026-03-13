# Security Best Practices Report

## Executive Summary

I reviewed the backend (NestJS + Mongoose + Socket.IO) and frontend (Next.js/React) for the requested classes of issues. I found multiple high-severity weaknesses, especially around authorization, input validation, NoSQL injection exposure, and unsafe file upload handling. The most urgent risks are invite authorization bypass, signup mass-assignment, hardcoded JWT secrets, and unrestricted file uploads served cross-origin.

## Findings By Severity

### High

**SBP-001 — Authorization bypass for invite management**

- Severity: High
- Location: `backend/src/invite/invite.controller.ts:4,8-14,25-29,43-47,51-55`
- Evidence:
  - `@Controller('api/invites')`
  - `@Post('create') ... @Body() body: { roomName, createdBy, ... }`
  - `@Post(':code/use') ... @Body('username') username`
  - `@Post(':code/deactivate') ... @Body('username') username`
  - `@Delete(':code') ... @Body('username') username`
- Impact: Any client can impersonate any user by sending `createdBy`/`username` in the body and create, deactivate, or delete invites for rooms they don’t own. This is a direct authorization bypass.
- Fix: Add `@UseGuards(JwtAuthGuard)` and derive the username from `req.user.username` (ignore user-supplied usernames). Enforce permission checks using the authenticated identity only.
- Mitigation: Add audit logging for invite actions to detect abuse.
- False positive notes: None. This is a direct trust of client-supplied identity.

**SBP-002 — Mass assignment on signup allows privilege escalation**

- Severity: High
- Location: `backend/src/auth/auth.service.ts:22-39`
- Evidence:
  - `async signup(userData: any)`
  - `const user = new this.userModel({ ...userData, password: hashedPassword, status: 'offline' })`
- Impact: A new user can submit fields like `globalRole`, `isPlatformBanned`, `isVerified`, `roomCreationLimit`, or `refreshToken` and gain elevated privileges or bypass restrictions.
- Fix: Whitelist allowed fields and build the user object explicitly (e.g., `username`, `email`, `password`, `displayName`, `country`, `gender`, `bio`). Use DTO validation with `class-validator` and a global validation pipe.
- Mitigation: Add schema-level `immutable` or `select: false` on sensitive fields where possible.
- False positive notes: Requires that the signup endpoint accepts arbitrary JSON (it does).

**SBP-003 — NoSQL injection risk in auth queries**

- Severity: High
- Location: `backend/src/auth/auth.service.ts:23-29,46`
- Evidence:
  - `findOne({ username: userData.username })`
  - `findOne({ email: userData.email })`
  - `findOne({ email })` in `login`
- Impact: If `email` or `username` is an object (e.g., `{ "$ne": null }`), Mongoose will treat it as a query operator. This can enable account enumeration or bypass checks.
- Fix: Enforce runtime validation with DTOs or a schema validator (e.g., `class-validator` or `zod`) and reject non-string values. Optionally add `express-mongo-sanitize` or a custom sanitizer at the app boundary.
- Mitigation: Add a global validation pipe and sanitize input in a single place.
- False positive notes: This is exploitable if the request body is unvalidated, which is the current state.

**SBP-004 — Unsafe file uploads stored and served cross-origin**

- Severity: High
- Location: `backend/src/upload/upload.controller.ts:12-21`, `backend/src/main.ts:12-20`
- Evidence:
  - `FileInterceptor('file', { storage: diskStorage({ destination: './uploads', filename: ... extname(file.originalname) }) })`
  - `app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/', setHeaders: ... Access-Control-Allow-Origin: '*' })`
- Impact: Arbitrary file types can be uploaded with original extensions and are served publicly under `/uploads/`. This enables stored XSS (e.g., SVG/HTML), malware hosting, or data exfiltration via cross-origin access.
- Fix: Use the `UploadService.validateAndUploadFile` logic or a `fileFilter` + allowlist in Multer. Store uploads outside publicly served roots, generate server-side filenames, and serve with `Content-Disposition: attachment` unless the file type is explicitly safe.
- Mitigation: Add antivirus scanning and restrict file types to images only if that is the intended use.
- False positive notes: High impact if uploads can include user-generated content visible to others (current behavior suggests this is true).

**SBP-005 — Hardcoded JWT secrets and weak default secrets**

- Severity: High
- Location: `backend/src/auth/auth.service.ts:11-12`, `backend/middleware/socket-auth.middleware.ts:37-38`
- Evidence:
  - `process.env.JWT_SECRET || 'your-secret-key-change-this'`
  - `process.env.JWT_REFRESH_SECRET || 'refresh-secret'`
- Impact: If environment variables are missing or misconfigured, attackers can forge valid JWTs using known default secrets.
- Fix: Fail fast on startup if secrets are missing. Remove fallbacks and require strong secrets set via environment or a secret manager.
- Mitigation: Rotate existing secrets and invalidate all tokens after remediation.
- False positive notes: If secrets are always provided in production, this risk is reduced but the fallback is still dangerous.

### Medium

**SBP-006 — Missing input validation across request bodies**

- Severity: Medium
- Location: `backend/src/auth/auth.controller.ts:9-24`, `backend/src/invite/invite.controller.ts:9-55`
- Evidence:
  - `@Body() body: any` on signup
  - `@Body()` without DTO validation for login/refresh/logout
  - Invite endpoints accept raw `username`/`createdBy` without validation
- Impact: Invalid or hostile input can reach business logic, enabling NoSQL injection, mass assignment, or inconsistent application behavior.
- Fix: Define DTOs with `class-validator` and enable a global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`.
- Mitigation: Add schema validation (e.g., zod) at service boundaries for websocket payloads too.
- False positive notes: None.

**SBP-007 — Insecure JWT refresh handling (no type check, plaintext storage)**

- Severity: Medium
- Location: `backend/src/auth/auth.service.ts:111-116,144-162`
- Evidence:
  - Refresh tokens are stored directly: `findByIdAndUpdate(userId, { refreshToken })`
  - No validation of `decoded.type` after `jwt.verify(refreshToken, ...)`
- Impact: A leaked database reveals long-lived refresh tokens. Missing type checks can allow misuse of other token types if secrets are shared or misconfigured.
- Fix: Store a hash of refresh tokens (e.g., SHA-256) and compare hashes. Validate `decoded.type === 'refresh'` before issuing new access tokens.
- Mitigation: Shorten refresh token TTL and rotate on every refresh.
- False positive notes: If you already protect DB at rest and in transit, the impact is reduced but still meaningful.

**SBP-008 — CORS policy is overly permissive for uploads**

- Severity: Medium
- Location: `backend/src/main.ts:17-19`
- Evidence:
  - `res.set('Access-Control-Allow-Origin', '*');`
  - `res.set('Cross-Origin-Resource-Policy', 'cross-origin');`
- Impact: Any origin can embed or fetch uploaded content. If uploads are private or user-specific, this enables cross-origin data leakage.
- Fix: Restrict allowed origins to a known allowlist and use `Cross-Origin-Resource-Policy: same-site` (or `same-origin`) for user content.
- Mitigation: Serve sensitive files via authenticated endpoints instead of static hosting.
- False positive notes: If uploads are intentionally public, document this decision and add rate limiting.

**SBP-009 — SSRF-capable link preview fetch without destination restrictions**

- Severity: Medium
- Location: `backend/src/link-preview/link-preview.service.ts:10-20`
- Evidence:
  - `const response = await fetch(url, ...)` with only `http/https` check
- Impact: Attackers can coerce the server to fetch internal resources (e.g., metadata services or private IPs).
- Fix: Add an allowlist for domains, block private IP ranges and localhost, enforce timeouts, and limit redirects.
- Mitigation: Apply network egress controls at the infrastructure level.
- False positive notes: Risk depends on network environment; verify whether the service can reach internal hosts.

### Low

**SBP-010 — Error details are sent to clients via WebSocket**

- Severity: Low
- Location: `backend/src/chat/chat.gateway.ts:249,2426,2489,2531,2590`
- Evidence:
  - `client.emit('error', { message: error.message })`
- Impact: Internal error messages can leak implementation details and aid attackers.
- Fix: Send generic messages to clients and log detailed errors server-side only.
- Mitigation: Add structured logging with redaction in `SecurityLogger`.
- False positive notes: If error messages are already sanitized, impact is lower.

**SBP-011 — Potential secret exposure via committed `.env`**

- Severity: Low
- Location: `backend/.env`
- Evidence:
  - `.env` file exists in the repository
- Impact: Secrets may be accidentally leaked if the repository is shared or logs are exposed.
- Fix: Remove `.env` from source control, add to `.gitignore`, and use `.env.example` with placeholders. Rotate any keys currently present.
- Mitigation: Use a secret manager (GitHub Actions secrets, Vault, etc.).
- False positive notes: If the file contains only non-sensitive values, impact is low.

**SBP-012 — No dependency vulnerability scan in CI**

- Severity: Low
- Location: `.github/workflows/ci.yml:1-52`
- Evidence:
  - CI installs and builds but does not run `npm audit` or similar
- Impact: Known vulnerabilities in critical packages could go unnoticed.
- Fix: Add `npm audit --audit-level=high` (or equivalent) in CI for backend and frontend. Consider Dependabot alerts.
- Mitigation: Run periodic audits manually if CI cannot be changed.
- False positive notes: This is a hygiene gap rather than an exploit by itself.
