# Global Luggage Storage Marketplace — Phase 1B: Identity, Authentication & Access Control

**Role:** Principal Identity Architect, Application Security Architect, Senior Backend Engineer, Database Architect, Mobile Authentication Engineer, Web Security Engineer & Independent QA Auditor

**Project:** Global Luggage Storage Marketplace  
**Repository:** `d:\luggage-storage\luggage-storage`  
**Phase:** Phase 1B — Identity, Authentication & Access Control  
**Previous Phase:** Phase 1A-R — Foundation Stabilization  
**Execution Mode:** Controlled implementation, security-first engineering, workflow-based testing and independent verification  
**Target Status:** PHASE 1B — READY FOR PRODUCT OWNER ACCEPTANCE

---

# 1. Mission

Implement the complete foundational identity, authentication and authorization infrastructure for the Global Luggage Storage Marketplace.

This phase establishes how users:

- Register and establish a unified identity.
- Authenticate securely.
- Maintain authenticated sessions.
- Access their authorized application experiences.
- Manage their own credentials and sessions.
- Obtain Traveller and Host profile contexts.
- Receive access according to backend-enforced roles and permissions.
- Are protected against unauthorized privilege escalation.
- Are audited when security-sensitive administrative actions occur.

The architecture must support the future global marketplace without prematurely implementing booking, payments, host onboarding, KYC or other marketplace functionality.

**Primary objective:** Build a secure identity and authorization foundation that every subsequent marketplace module can depend on.

Do not treat this as a simple login/register feature.

---

# 2. Mandatory Entry Gate — Phase 1A-R Acceptance

Before writing application code:

1. Inspect `docs/engineering/phase-1a-r-completion-report.md`.
2. Inspect the actual Phase 1A-R implementation and verification evidence.
3. Verify that Phase 1A-R has been formally accepted by the Product Owner.
4. Verify that the actual framework versions, workspace configuration, database connectivity and testing foundation are suitable for Phase 1B.
5. Inspect the Phase 0C-D Product Owner acceptance record.

Required documents:

- `docs/governance/phase-0c-product-owner-acceptance.md`
- `docs/engineering/phase-1a-completion-report.md`
- `docs/engineering/phase-1a-r-completion-report.md`
- `docs/engineering/repository-architecture.md`
- `docs/engineering/coding-standards.md`
- `docs/engineering/testing-strategy.md`
- `docs/engineering/environment-management.md`
- `docs/engineering/database-development.md`
- `docs/engineering/api-conventions.md`
- `.agents/engineering-agent-guidance.md`

If Phase 1A-R has not been formally accepted, stop and report:

**PHASE 1B — BLOCKED: PREVIOUS PHASE ACCEPTANCE REQUIRED**

Do not assume that a completion report automatically constitutes Product Owner acceptance.

---

# 3. Authoritative Product and Architecture Decisions

The following decisions are approved and must be preserved.

## 3.1 Unified identity

**OQ-007 — Unified User Identity**

One `User` identity may have multiple profiles and roles.

The architecture must support:

- Traveller profile.
- Host profile.
- Support staff access.
- Superadmin access.

A user must not need separate accounts to operate as both Traveller and Host.

Profiles and roles must remain separate concepts.

## 3.2 Authentication

**OQ-001 — Self-managed authentication**

The approved authentication baseline is:

- Authentication managed by the Fastify backend.
- PostgreSQL as the authoritative identity and session data store.
- Argon2id for password hashing.
- Short-lived access credentials.
- Rotating refresh sessions.
- HTTP-only secure cookies for web authentication.
- Secure platform storage for mobile refresh credentials.
- Server-side authorization.
- Social login optional and deferred.

Do not mandate an unapproved authentication library.

Do not replace the approved architecture with an external identity provider.

## 3.3 Authorization and administrative boundaries

**OQ-011 — Support and Superadmin separation**

Support staff can:

- Access the minimum information required for customer support.
- Search bookings when authorized.
- View support-related information.
- Create and update support tickets.
- Add internal support notes.
- Escalate cases.
- Recommend actions.

Support staff cannot:

- Approve or reject Host KYC.
- Change commission or platform policies.
- Initiate refunds.
- Execute payouts.
- Alter financial ledger records.
- Grant Superadmin privileges.

Superadmin access is separately authorized and includes platform administration capabilities defined in the approved permission matrix.

**OQ-016** retains the remaining operational support workflow decisions. Do not silently treat it as an authorization to expand Support permissions.

## 3.4 External dependencies remain pending

Do not silently choose or integrate:

- Email provider — OQ-019.
- SMS/OTP provider — OQ-020.
- KYC provider — OQ-002.
- Social login provider.
- External authentication SaaS.
- Unapproved paid security services.

Design integration boundaries where useful.

Do not pretend that a notification or verification was successfully delivered when no approved provider is configured.

---

# 4. Scope of Phase 1B

## Included

1. Identity domain.
2. User registration.
3. Password-based authentication.
4. Password hashing and verification.
5. Access token lifecycle.
6. Refresh token rotation.
7. Session management.
8. Logout and session revocation.
9. Password change.
10. Password recovery foundation.
11. Account status and access restrictions.
12. Traveller and Host profile foundations.
13. Role assignment and permission management.
14. Backend RBAC enforcement.
15. Superadmin bootstrap security.
16. Web authentication integration.
17. Mobile authentication integration.
18. Security audit events.
19. Authentication and authorization testing.
20. Security documentation.

## Excluded

Do not implement:

- Host business registration and onboarding.
- Host KYC workflows.
- KYC document uploads.
- Storage location management.
- Traveller booking.
- Search and discovery.
- Payments.
- Refunds.
- Payouts.
- Financial ledger.
- Custody verification.
- Email or SMS provider integration.
- Social login.
- Production identity-provider migration.
- Complete Superadmin dashboard.
- Complete Support dashboard.
- Marketplace business permissions beyond the approved authorization baseline.

Where a later workflow requires an identity capability, establish the necessary foundation without implementing that workflow.

---

# 5. WP-01 — Identity Domain Architecture

Before implementing identity functionality, inspect the approved logical ERD and domain catalogue.

Produce:

`docs/architecture/phase-1b-identity-design.md`

The design must define the following concepts.

## 5.1 User

A unified identity record.

Proposed responsibilities:

- Stable user ID.
- Primary email address.
- Normalized email representation.
- Optional phone number.
- Display name.
- Password hash.
- Account status.
- Email verification status.
- Security timestamps.
- Created/updated timestamps.

Do not store plaintext passwords.

Do not store raw refresh tokens.

Avoid placing profile-specific information in the central User record.

## 5.2 Traveller profile

Represents the user's Traveller experience.

Do not duplicate authentication credentials.

Keep profile data separate from User identity.

Only implement fields supported by the approved requirements or clearly justified identity needs.

Do not prematurely implement traveller preferences, booking history or traveller marketplace functionality.

## 5.3 Host profile

Represents the user's Host identity context.

A unified user may eventually have both Traveller and Host profiles.

Important:

- Do not implement Host business onboarding.
- Do not implement KYC.
- Do not automatically grant approved Host operating privileges merely because a profile exists.
- Preserve the distinction between a Host profile, a Host role and authorization to operate a Host business.
- Record unresolved Host activation and verification dependencies against OQ-002.

Do not invent a Host approval policy.

## 5.4 Roles and permissions

Design role and permission records or an equally maintainable authorization model.

Avoid hardcoding role checks throughout application modules.

Use centralized authorization definitions.

The design must support multiple roles per user.

## 5.5 Sessions

Represent authenticated sessions independently of User records.

A user may have multiple active sessions across devices.

Each session must support:

- Session ID.
- User reference.
- Refresh-token hash or equivalent secure verifier.
- Expiry.
- Revocation status.
- Rotation metadata.
- Created timestamp.
- Last-used timestamp.
- Device/session metadata where appropriate.
- Security event references.

Do not collect unnecessary device fingerprinting data.

## 5.6 Security events

Establish a separate audit model for authentication and authorization security events.

Examples:

- Registration.
- Successful authentication.
- Failed authentication.
- Logout.
- Session revocation.
- Refresh rotation.
- Refresh reuse detection.
- Password change.
- Password recovery request.
- Password reset.
- Account suspension.
- Role assignment.
- Permission changes.
- Administrative account actions.

Never record passwords, raw tokens, session secrets or sensitive credential material in logs.

---

# 6. WP-02 — Database Implementation

Use the approved PostgreSQL, PostGIS and Drizzle foundation.

Inspect the existing logical ERD before creating migrations.

Implement only the identity-related tables needed for this phase.

Potential tables include:

- `users`
- `traveller_profiles`
- `host_profiles`
- `roles`
- `permissions`
- `user_roles`
- `role_permissions`
- `auth_sessions`
- `security_audit_events`
- `password_reset_tokens` or an equivalent secure recovery-token store

The final names and structure must be justified against the approved architecture.

## Database requirements

- UUIDv7 or the approved stable identifier strategy.
- Appropriate unique constraints.
- Appropriate foreign keys.
- Appropriate indexes.
- Explicit account and session states.
- Transaction-safe role assignment.
- No floating-point financial fields.
- No unnecessary personal data.
- No plaintext credentials.
- No raw refresh-token storage.
- No silent destructive migrations.

Use database constraints to enforce important invariants.

Do not implement unrelated marketplace tables.

## Migration requirements

- Use reproducible migrations.
- Verify migration execution against the development database.
- Verify rollback or recovery strategy.
- Never drop or overwrite existing user data.
- Never run destructive migration operations against production.
- Document migration dependencies and ordering.

---

# 7. WP-03 — Registration and Authentication

Implement secure password-based authentication.

## 7.1 Registration

Provide the registration foundation for a unified user identity.

Requirements:

- Validate inputs on the server.
- Normalize email addresses consistently.
- Enforce unique identity rules.
- Hash passwords using Argon2id.
- Use safe password policy rules.
- Prevent duplicate account creation.
- Prevent account enumeration where practical.
- Return consistent error envelopes.
- Do not expose password hashes.
- Do not automatically grant privileged roles.

The initial registration flow must not depend on an unapproved email delivery provider.

Email verification status must be explicit.

If email verification delivery is not configured, the account must remain unverified. Do not silently mark it verified.

Document the exact restrictions imposed on unverified accounts.

Do not invent a complete email-verification delivery flow.

## 7.2 Password security

Use Argon2id with parameters selected according to current OWASP guidance and realistic deployment resource constraints.

Document:

- Algorithm.
- Memory cost.
- Iterations.
- Parallelism.
- Salt handling.
- Hash format.
- Rehash policy.

Do not invent a custom password hashing algorithm.

## 7.3 Login

Implement:

- Email/password authentication.
- Account status checks.
- Password verification.
- Session creation.
- Access credential issuance.
- Refresh credential issuance.
- Failed login handling.
- Appropriate rate limiting.
- Consistent authentication errors.

Do not reveal whether an email address exists through distinguishable login errors.

## 7.4 Access credentials

Implement short-lived access credentials.

The architecture must define:

- Signing algorithm.
- Issuer.
- Audience.
- Subject.
- Issued-at timestamp.
- Expiration.
- Session identifier.
- Key configuration.
- Key rotation strategy.

Use a secure, well-maintained cryptographic implementation.

Do not implement custom JWT cryptography.

Do not hardcode signing secrets.

Keep access credentials short-lived and avoid storing sensitive profile information inside them.

Authorization must still be checked against current account/session/permission state where required. Do not rely on a long-lived token's role claims as the sole source of authorization.

## 7.5 Refresh-token rotation

Implement secure rotating refresh sessions.

Requirements:

- Generate high-entropy refresh credentials.
- Store only a cryptographic hash or secure verifier.
- Rotate refresh credentials after successful use.
- Detect reuse of a previously rotated credential.
- Revoke the affected session or token family according to the approved security policy.
- Prevent concurrent refresh races.
- Enforce session expiration.
- Handle revoked sessions.
- Make refresh operations transaction-safe.
- Ensure a refresh credential cannot be reused indefinitely.

Document the precise rotation and reuse-detection policy.

Do not expose refresh tokens through JSON responses for the web application.

---

# 8. WP-04 — Session Management and Logout

Implement:

- Login session creation.
- Current-session retrieval.
- Current-session logout.
- All-session logout.
- Individual session revocation.
- Session expiry.
- Refresh rotation.
- Revoked-session rejection.

Provide the necessary API contracts.

The user should be able to identify and revoke their own active sessions.

Do not expose other users' session metadata.

For administrative session revocation, require an explicit permission and audit event.

A revoked session must not continue authenticating through previously issued refresh credentials.

Where short-lived access tokens cannot be immediately invalidated without server-side state, document the residual access window and implement the approved mitigation.

---

# 9. WP-05 — Password Change and Recovery

## Password change

Implement authenticated password change.

Requirements:

- Require the current password.
- Validate the new password.
- Hash the new password with Argon2id.
- Record the security event.
- Apply the approved session-revocation policy.
- Prevent accidental password disclosure.

## Password recovery

Build the secure recovery foundation, but respect OQ-019.

Requirements:

- Generic recovery response to prevent account enumeration.
- Cryptographically random, single-use recovery token.
- Secure token hash storage.
- Short expiry.
- Atomic token consumption.
- Rate limiting.
- Security event recording.
- Session invalidation according to the approved policy.

Because the email provider is not approved:

- Do not choose an email provider.
- Do not send real email.
- Do not expose recovery tokens through production API responses.
- Do not implement insecure development shortcuts that could be enabled in production.
- Define a delivery adapter boundary.
- Document how the recovery workflow becomes operational after provider approval.

If the end-to-end delivery workflow cannot be verified without an approved provider, classify that portion as blocked rather than pretending it is complete.

---

# 10. WP-06 — Account Lifecycle and Security States

Define and implement explicit account states.

The design should support:

- Active.
- Unverified.
- Suspended.
- Locked or restricted, where justified.
- Deactivated, where justified.

Do not create overlapping states with unclear semantics.

Document:

- Which operations are allowed in each state.
- Which roles can change states.
- How sessions are invalidated.
- How the user is informed.
- How an account is reactivated.
- How administrative actions are audited.

Account suspension must invalidate or block active authentication sessions according to the approved security policy.

Do not invent a permanent account deletion or personal-data retention policy.

Those policies must remain consistent with applicable legal requirements and the approved data governance architecture.

---

# 11. WP-07 — RBAC and Permission Architecture

This is one of the most important parts of Phase 1B.

Implement centralized, backend-enforced RBAC.

## 11.1 Required roles

Support the approved role concepts:

- `TRAVELLER`
- `HOST`
- `SUPPORT`
- `SUPERADMIN`

Preserve the existing approved role terminology if the authoritative architecture defines additional role distinctions.

Do not invent new privileged roles.

## 11.2 Role assignment rules

- Users cannot assign roles to themselves.
- Public registration cannot assign `SUPPORT` or `SUPERADMIN`.
- Users cannot modify their own permission grants.
- Host profile creation must not automatically authorize Host business operations.
- Support role assignment requires an authorized administrative process.
- Superadmin assignment must require a tightly controlled bootstrap or authorized administrative process.
- Role changes must be transactional and audited.

## 11.3 Permission model

Use granular permissions rather than broad frontend role checks.

Examples of permission naming conventions:

- `identity.profile.read`
- `identity.profile.update`
- `identity.session.read_own`
- `identity.session.revoke_own`
- `identity.session.revoke_any`
- `identity.role.assign`
- `identity.account.suspend`
- `support.ticket.read`
- `support.ticket.update`
- `admin.platform.manage`

These are examples. Final permissions must be mapped against the approved permission matrix and actual Phase 1B responsibilities.

Do not invent permissions that grant functionality belonging to future modules.

## 11.4 Enforcement requirements

Enforce permissions at the backend boundary.

Implement reusable:

- Authentication pre-handler.
- Permission guard.
- Role/permission resolution.
- Ownership checks where applicable.
- Administrative action authorization.
- Deny-by-default behavior.

Do not rely on:

- Frontend route guards.
- Hidden buttons.
- Disabled controls.
- Client-side role values.
- Unverified JWT role claims.

Every protected API operation must have an explicit authorization requirement.

## 11.5 Support restrictions

Enforce the approved Support restrictions.

Support must not be able to:

- Approve or reject KYC.
- Change commission or platform policies.
- Initiate refunds.
- Execute payouts.
- Alter financial ledger records.
- Grant Superadmin privileges.

Do not implement these future domain actions in Phase 1B. Establish the permission model that will prevent unauthorized access when those modules are added.

## 11.6 Superadmin safeguards

Superadmin privileges must be protected by:

- No public self-assignment.
- Restricted bootstrap process.
- Audited role grants.
- Explicit permission checks.
- Secure account lifecycle controls.
- Session revocation support.
- No hardcoded production credentials.

Document the first Superadmin provisioning procedure.

A development seed may be provided only with safe development-only configuration and no production-capable default credentials.

Do not automatically create a production Superadmin account.

---

# 12. WP-08 — Web Authentication Integration

Implement the foundational authentication experience in `apps/web`.

Required capabilities:

- Registration screen.
- Login screen.
- Authenticated application state.
- Session restoration.
- Logout.
- Session management screen.
- Password change screen.
- Password recovery request screen.
- Appropriate unverified-account messaging.
- Unauthorized and forbidden states.

Follow the approved public website, Host dashboard and Superadmin dashboard boundaries.

Do not build complete Host or Superadmin dashboards.

## Web security requirements

- Use HTTP-only cookies for refresh credentials.
- Use `Secure` in HTTPS production environments.
- Use appropriate `SameSite` settings.
- Protect cookie-authenticated state-changing requests against CSRF.
- Validate allowed origins.
- Avoid storing refresh tokens in localStorage or sessionStorage.
- Avoid exposing access or refresh credentials in browser logs.
- Avoid leaking session credentials in URLs.
- Prevent open redirects.
- Handle session expiry and revocation safely.

Choose a clear access-token delivery strategy consistent with the approved architecture.

If access credentials are held in memory, document the refresh and page-reload behavior.

If cookie-based access is selected, document the CSRF implications and safeguards.

Do not silently use insecure cookie settings to bypass development problems.

---

# 13. WP-09 — Mobile Authentication Integration

Implement authentication integration in `apps/mobile`.

Requirements:

- Registration.
- Login.
- Session restoration.
- Token refresh.
- Logout.
- Session revocation.
- Password change.
- Password recovery request.
- Account status handling.
- Authenticated navigation.
- Unauthorized handling.

## Mobile security

- Store refresh credentials using platform secure storage.
- Do not store refresh tokens in ordinary AsyncStorage.
- Avoid storing passwords.
- Avoid logging credentials.
- Ensure logout removes local credential material.
- Handle refresh failure safely.
- Prevent concurrent refresh operations.
- Protect Traveller and Host navigation boundaries.
- Avoid trusting locally stored role values for authorization.

The same mobile codebase must support Traveller and Host experiences.

Do not implement Host onboarding or Host business operations.

Document how the application behaves when a user has multiple profiles or roles.

Verify Android development/build capabilities where available.

Document EAS cloud build requirements for iOS.

---

# 14. WP-10 — API Contract and Endpoint Design

Follow the existing API conventions.

Design and implement versioned authentication endpoints.

Suggested endpoint families:

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/logout-all

GET    /api/v1/auth/me
GET    /api/v1/auth/sessions
DELETE /api/v1/auth/sessions/:sessionId

POST   /api/v1/auth/password/change
POST   /api/v1/auth/password/recovery
POST   /api/v1/auth/password/reset

GET    /api/v1/identity/profile
PATCH  /api/v1/identity/profile
```

These are proposed endpoint names, not permission to create unnecessary endpoints.

Finalize contracts before implementation.

For every endpoint document:

- HTTP method.
- Request schema.
- Response schema.
- Authentication requirement.
- Required permission.
- Rate limit.
- Validation behavior.
- Error cases.
- Audit event behavior.

Ensure refresh endpoint transport is appropriate for web and mobile. A cookie-based web flow and secure-storage mobile flow may need different transport handling while sharing the same underlying session domain.

Never expose sensitive token values in ordinary response envelopes.

---

# 15. WP-11 — Authentication and Authorization Security Testing

Security testing is mandatory.

Create automated tests for the following scenarios.

## Registration

- Valid registration.
- Invalid email.
- Duplicate email.
- Weak password.
- Malformed request.
- Attempted privileged role assignment.
- Password hash is never returned.

## Authentication

- Valid login.
- Invalid password.
- Unknown account.
- Suspended account.
- Unverified account behavior.
- Rate limiting.
- Credential leakage checks.

## Sessions

- Session creation.
- Session restoration.
- Refresh rotation.
- Reuse detection.
- Expired refresh credential.
- Revoked refresh credential.
- Concurrent refresh attempts.
- Logout.
- Logout-all.
- Individual session revocation.

## Password recovery

- Generic responses.
- Invalid token.
- Expired token.
- Reused token.
- Concurrent token consumption.
- Rate limiting.
- No token disclosure.

## RBAC

- Anonymous request to protected endpoint.
- Authenticated request without permission.
- Traveller attempting Host-only operation.
- Host attempting Support-only operation.
- Support attempting Superadmin operation.
- User attempting self-role escalation.
- User attempting to access another user's sessions.
- Suspended user using an existing session.
- Role removal followed by access attempt.

## Web security

- CSRF protection.
- Cookie security attributes.
- CORS restrictions.
- Session restoration.
- Logout behavior.
- Open redirect protection.
- Token leakage checks.

## Mobile security

- Secure refresh storage.
- Logout cleanup.
- Expired session handling.
- Refresh concurrency.
- Navigation isolation.
- No credentials in logs.

Use deterministic test fixtures.

Do not rely on manually clicking login once as proof of authentication security.

---

# 16. WP-12 — Auditability and Operational Security

Establish structured security events.

Record:

- Event type.
- Actor user ID where known.
- Target user ID where applicable.
- Session reference where applicable.
- Timestamp.
- Request correlation ID.
- Outcome.
- Safe contextual metadata.

Do not record:

- Passwords.
- Password hashes.
- Raw access tokens.
- Raw refresh tokens.
- Recovery tokens.
- Secret keys.
- Sensitive authentication headers.

Administrative actions must be auditable.

Audit records must not be editable by ordinary users.

Document retention assumptions as proposals until legally approved.

---

# 17. WP-13 — Security Architecture Documentation

Create or update:

```text
docs/architecture/identity/
├── identity-domain-model.md
├── authentication-architecture.md
├── session-lifecycle.md
├── authorization-and-rbac.md
├── account-lifecycle.md
├── password-and-recovery-security.md
├── web-authentication-security.md
├── mobile-authentication-security.md
├── security-event-catalogue.md
└── identity-threat-model.md
```

Also create:

`docs/engineering/phase-1b-implementation-report.md`

The threat model must consider:

- Credential stuffing.
- Brute-force attempts.
- Account enumeration.
- Password database compromise.
- Session theft.
- Refresh-token replay.
- CSRF.
- XSS-related token exposure.
- Privilege escalation.
- IDOR.
- Insecure account recovery.
- Compromised administrative accounts.
- Session fixation.
- Concurrent refresh races.
- Audit-log tampering.

Use the OWASP ASVS and OWASP API Security guidance as reference frameworks.

Do not claim formal security certification.

---

# 18. WP-14 — Engineering Quality and Regression Verification

Before declaring completion, execute the complete repository quality suite.

Required:

- Frozen-lockfile dependency installation.
- Lint.
- Typecheck.
- Unit tests.
- Backend integration tests.
- API contract tests.
- Web tests.
- Mobile tests.
- Backend build.
- Web build.
- Mobile export/build validation.
- Database migration verification.
- Security tests.
- Dependency audit.
- CI verification.

Verify that all previous Phase 1A-R functionality remains operational.

Inspect the complete Git diff.

Confirm:

- No Phase 0A/0B/0C-D approved decisions were silently changed.
- No unrelated marketplace business logic was introduced.
- No unapproved provider was integrated.
- No credentials were committed.
- No destructive migrations were performed.

---

# 19. Explicitly Prohibited Shortcuts

The following are unacceptable:

1. Storing passwords as plaintext.
2. Using MD5 or SHA-1 for password hashing.
3. Storing raw refresh tokens in the database.
4. Storing refresh tokens in browser localStorage.
5. Trusting frontend role checks.
6. Allowing public Superadmin registration.
7. Allowing users to assign their own privileged roles.
8. Treating a Host profile as automatic KYC approval.
9. Returning recovery tokens in production API responses.
10. Treating email verification as successful without verification.
11. Using permanent access tokens.
12. Ignoring refresh-token replay.
13. Logging secrets.
14. Returning different login errors that reveal account existence.
15. Implementing custom cryptographic primitives.
16. Disabling security checks for development convenience.
17. Creating broad Superadmin permissions without an explicit permission matrix.
18. Claiming security based solely on successful login tests.

---

# 20. Phase 1B Acceptance Criteria

| ID | Acceptance criterion |
|---|---|
| B1 | Phase 1A-R formal acceptance verified |
| B2 | Identity architecture documented |
| B3 | Unified User identity implemented |
| B4 | Traveller and Host profile boundaries implemented |
| B5 | Identity database migrations verified |
| B6 | Argon2id password hashing verified |
| B7 | Registration and login workflows tested |
| B8 | Access credential lifecycle implemented |
| B9 | Refresh-token rotation and replay detection tested |
| B10 | Session management and revocation tested |
| B11 | Password change implemented and tested |
| B12 | Recovery foundation implemented with provider limitations documented |
| B13 | Account lifecycle controls implemented |
| B14 | Centralized RBAC implemented |
| B15 | Support/Superadmin boundaries enforced |
| B16 | Superadmin bootstrap protected |
| B17 | Web authentication integration verified |
| B18 | Mobile authentication integration verified |
| B19 | Security audit events implemented |
| B20 | Security test suite passes |
| B21 | Previous foundation regression tests pass |
| B22 | Documentation and threat model complete |
| B23 | No prohibited functionality introduced |
| B24 | Final diff and scope audit completed |

If a mandatory criterion depends on an unapproved external provider, mark it `BLOCKED` and explain why.

Do not claim full acceptance if mandatory authentication or authorization guarantees remain unverified.

---

# 21. Required Completion Report

Create:

`docs/engineering/phase-1b-implementation-report.md`

Include:

1. Executive summary.
2. Previous-phase acceptance verification.
3. Identity architecture.
4. Database schema and migration summary.
5. Authentication implementation.
6. Password security configuration.
7. Access credential lifecycle.
8. Refresh-token rotation and replay protection.
9. Session management.
10. Password recovery limitations.
11. Account lifecycle.
12. RBAC and permission matrix.
13. Superadmin provisioning.
14. Web integration.
15. Mobile integration.
16. Security event implementation.
17. Threat model findings.
18. Security test results.
19. Full regression test results.
20. Exact commands executed.
21. Actual outputs/evidence.
22. Files created and modified.
23. External dependencies still pending.
24. Known limitations.
25. Acceptance criteria matrix.
26. Recommended next phase.

For every claim, distinguish:

- Implemented.
- Configured.
- Tested.
- Partially verified.
- Blocked.
- Not implemented.

Use only these final statuses:

- `PHASE 1B — READY FOR PRODUCT OWNER ACCEPTANCE`
- `PHASE 1B — NOT COMPLETE`
- `PHASE 1B — BLOCKED`

Never claim completion based on file existence or generated audit documents.

---

# 22. Git and Change Management

Before implementation:

- Inspect Git status.
- Preserve existing uncommitted work.
- Do not reset or clean the repository.
- Do not overwrite existing architecture documents without justification.

During implementation:

- Keep changes limited to Phase 1B.
- Maintain migration safety.
- Avoid unrelated refactoring.

After implementation:

- Inspect the full diff.
- Review database migrations.
- Check for secrets.
- Review dependency changes.
- Verify test evidence.
- Do not push, publish or deploy without explicit authorization.

---

# 23. Final Execution Instructions

Work in the following strict order:

1. Verify Phase 1A-R acceptance.
2. Inspect authoritative identity requirements and architecture.
3. Create the identity design and permission matrix.
4. Review the design against OQ-001, OQ-007, OQ-011 and OQ-016.
5. Implement identity database foundations.
6. Implement authentication and session lifecycle.
7. Implement account lifecycle.
8. Implement centralized RBAC.
9. Integrate web authentication.
10. Integrate mobile authentication.
11. Implement security auditing.
12. Execute security and regression tests.
13. Complete documentation.
14. Perform independent final verification.
15. Produce the completion report.
16. Stop and wait for Product Owner review.

**Do not start Phase 1C.**

**Do not begin Host onboarding, KYC, storage location management or marketplace business functionality.**

The deliverable is a secure, unified identity and authorization foundation that subsequent marketplace domains can safely depend on.

Prioritize security correctness over implementation speed. Preserve the approved architecture. Use evidence rather than assumptions. If a decision is unresolved, record it rather than inventing an answer.

Begin with the mandatory Phase 1A-R acceptance gate.