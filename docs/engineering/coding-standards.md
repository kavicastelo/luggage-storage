# Engineering Governance — Coding Standards & Guidelines

**Document ID:** ENG-DOC-003  
**Version:** 1.0.0  
**Phase:** Phase 1A — Engineering Foundation  
**Status:** Approved Engineering Baseline  
**Applicability:** All TypeScript and JavaScript code across the monorepo  

---

## 1. Core Philosophy

The Global Luggage Storage Marketplace codebase enforces strict, readable, type-safe, and defensively architected code. Every pull request and agentic change is evaluated against readability, maintainability, and domain integrity.

---

## 2. TypeScript Guidelines

### Strict Compiler Compliance
All packages and applications must extend `@luggage-storage/typescript-config` with strict rules enabled:
- `"strict": true`
- `"noImplicitAny": true`
- `"strictNullChecks": true`
- `"noUncheckedIndexedAccess": true`
- `"exactOptionalPropertyTypes": true`

### Prohibited Types & Patterns
1. **No `any`:** The use of `any` is strictly banned. Use `unknown` with runtime type narrowing (such as Zod schema parsing or type guard predicates).
2. **No Non-Null Assertions (`!`):** Avoid the non-null assertion operator `!` unless immediately preceded by a verified runtime guard.
3. **Explicit Return Types:** All exported functions, service methods, and API route handlers must declare explicit return types to preserve type contracts during refactoring.

### Naming Conventions
- **Types, Interfaces, Classes, Components:** `PascalCase` (e.g. `ApiResponse`, `StorageCapacityPool`, `AppShell`).
- **Functions, Methods, Variables, Properties:** `camelCase` (e.g. `calculateAvailableCapacity`, `paymentStatus`, `userId`).
- **Constants & Enums:** `UPPER_SNAKE_CASE` (e.g. `MAX_BAG_COUNT`, `DEFAULT_CURRENCY`).
- **Files & Directories:**
  - Standard TypeScript/utility files: `kebab-case.ts` (e.g. `connection.ts`, `app-error.ts`).
  - React components: `PascalCase.tsx` (e.g. `AppShell.tsx`, `HomePage.tsx`).
  - Route handlers & modules: `kebab-case.routes.ts` (e.g. `health.routes.ts`).
  - Test files: `*.test.ts` or `*.spec.ts`.

---

## 3. Architecture & Layering Conventions

### Hexagonal Architecture (Ports and Adapters)
External integrations (such as payment providers, notification gateways, and external map APIs) must strictly implement decoupled port interfaces:
1. **Domain/Application defines Port:** An interface specifying required operations (e.g. `PaymentGatewayPort`).
2. **Infrastructure implements Adapter:** A concrete implementation interacting with the external provider (e.g. `PayHerePaymentAdapter`).
3. **Dependency Injection:** Services receive the port interface via constructor or factory injection, preventing direct vendor lock-in.

### API Layer Separation
Every API module in `apps/api` must adhere to the three-tier layer boundary:
1. **Route / Controller Layer (`*.routes.ts`):** Validates input payloads using Zod schemas, extracts HTTP context, and delegates to the service layer. Contains zero business calculations.
2. **Service / Domain Layer (`*.service.ts`):** Contains business logic, state transitions, ledger balancing validations, and concurrency controls.
3. **Data / Repository Layer (`*.repository.ts`):** Executes queries and mutations using Drizzle ORM against PostgreSQL.

---

## 4. Error Handling & Response Consistency

### Standardized Error Class
All expected application failures must throw subclasses of `AppError`:
```typescript
import { AppError } from '../common/errors/app-error.js';

if (!location) {
  throw new AppError(
    'STORAGE_LOCATION_NOT_FOUND',
    'The requested luggage storage location does not exist.',
    404,
    { locationId }
  );
}
```

### Standardized API Envelopes
Responses must adhere to the shared contract defined in `@luggage-storage/contracts`:
- **Success:** `{ success: true, data: T, meta: { ... } }`
- **Failure:** `{ success: false, error: { code: string, message: string, details?: unknown }, meta: { ... } }`

---

## 5. Security & Defensive Programming

1. **Zero Secret Leaks:** API keys, database credentials, and signing secrets must never be hardcoded or checked into version control. All configuration must load through Zod-validated environment files (`src/config/env.ts`).
2. **No `console.log` in Production Code:** All logging must use the structured Pino logger instance (`req.log` or root `logger`), including correlation IDs and contextual metadata.
3. **Parameterized SQL Queries:** Never construct SQL queries via string interpolation or concatenation. Always use Drizzle ORM query builders or parameterized SQL tags.
4. **Boundary Validation:** Every request payload, URL parameter, query parameter, and external webhook payload must be validated via Zod before processing.

