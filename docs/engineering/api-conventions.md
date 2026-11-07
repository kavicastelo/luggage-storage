# Engineering Governance — API Conventions & Standards

**Document ID:** ENG-DOC-007  
**Version:** 1.0.0  
**Phase:** Phase 1A — Engineering Foundation  
**Status:** Approved Engineering Baseline  
**Applicability:** Fastify backend API endpoints, client consumers, and API documentation  

---

## 1. RESTful URL & Route Taxonomy

All client-facing backend routes follow standard RESTful conventions:

### Infrastructure & Health Endpoints
- **Liveness Probe (`GET /health` and `GET /api/v1/health`):**
  - Evaluates whether the Node.js Fastify process is responsive.
  - Returns `200 OK` with `{ status: "ok", uptime: number, timestamp: string }`.
  - Zero database or network I/O; fast sub-millisecond execution.
- **Readiness Probe (`GET /ready`):**
  - Evaluates whether external backend dependencies (PostgreSQL 16 connection pool and PostGIS 3 spatial extension) are accessible and able to serve traffic.
  - Returns `200 OK` with `{ status: "ready", database: { connected: true, postgis: "..." } }` when healthy.
  - Returns `503 Service Unavailable` with structured `ApiErrorResponse` (code: `SERVICE_UNAVAILABLE`) when database connection fails.
  - **SECURITY MANDATE:** Never exposes raw connection strings, usernames, passwords, or internal network topology in readiness responses.
- **Interactive Documentation (`GET /docs`):**
  - Swagger UI rendering live OpenAPI 3.0 specification.
- **Schema Export (`GET /docs/json`):**
  - Raw JSON specification for client SDK generation.

### Resource Naming Standards
- **Plural Nouns:** Route endpoints use plural nouns in `kebab-case` (e.g. `/api/v1/storage-locations`, `/api/v1/capacity-holds`).
- **Resource Identification:** Single resource instances use path parameters (e.g. `/api/v1/bookings/:bookingId`).
- **Sub-Resources:** Hierarchical relations use nested path segments (e.g. `/api/v1/storage-locations/:locationId/operating-hours`).
- **State Transition Actions:** State modifications that represent explicit business actions use POST on action sub-resources (e.g. `/api/v1/bookings/:bookingId/check-in`, `/api/v1/bookings/:bookingId/release`).

---

## 2. HTTP Methods & Standard Status Codes

| HTTP Method | Purpose | Expected Status Code | Description |
| :--- | :--- | :--- | :--- |
| **GET** | Retrieve resource or collection | `200 OK` | Safe, idempotent read |
| **POST** | Create resource or invoke domain command | `201 Created` / `200 OK` | Resource creation or state transition |
| **PATCH** | Partial update of existing resource | `200 OK` | Updates only provided fields |
| **DELETE** | Remove resource or cancel reservation | `200 OK` / `204 No Content` | Soft-delete or record deprecation |

### Error Status Codes
- `400 Bad Request`: Payload failed Zod schema validation or malformed JSON.
- `401 Unauthorized`: Missing, expired, or invalid authentication credentials.
- `403 Forbidden`: Authenticated user lacks permission for the requested action.
- `404 Not Found`: Target resource does not exist.
- `409 Conflict`: Business rule violation (e.g., capacity full, concurrent modification, invalid state transition).
- `422 Unprocessable Entity`: Semantic domain rule violation.
- `429 Too Many Requests`: Rate limit exceeded.
- `500 Internal Server Error`: Unhandled server exception.

---

## 3. Standardized Response Envelopes

Every API response emitted by the Fastify backend adheres strictly to the `@luggage-storage/contracts` envelope specification.

### Successful Single Resource Response (`ApiResponse<T>`)
```json
{
  "success": true,
  "data": {
    "id": "loc_01hw8g...",
    "name": "Colombo Fort Station Storage",
    "totalCapacity": 50,
    "availableCapacity": 32
  },
  "meta": {
    "timestamp": "2026-11-07T04:30:00.000Z",
    "correlationId": "886daf1c-5acc-4ced-b639-14242c306de2"
  }
}
```

### Successful Paginated Response (`PaginatedApiResponse<T>`)
```json
{
  "success": true,
  "data": [
    { "id": "loc_01", "name": "Colombo Central" },
    { "id": "loc_02", "name": "Galle Face Hub" }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  },
  "meta": {
    "timestamp": "2026-11-07T04:30:00.000Z",
    "correlationId": "886daf1c-5acc-4ced-b639-14242c306de2"
  }
}
```

### Structured Error Response (`ApiErrorResponse`)
```json
{
  "success": false,
  "error": {
    "code": "CAPACITY_EXCEEDED",
    "message": "The requested storage location does not have enough capacity for 3 bags.",
    "details": {
      "requestedBags": 3,
      "availableBags": 1
    }
  },
  "meta": {
    "timestamp": "2026-11-07T04:30:00.000Z",
    "correlationId": "886daf1c-5acc-4ced-b639-14242c306de2"
  }
}
```

---

## 4. Correlation IDs & Distributed Tracing

1. **Header Inspection:** Every incoming HTTP request is inspected for the `x-correlation-id` header.
2. **Deterministic Generation:** If the header is missing, Fastify generates a cryptographically random UUIDv4 via `randomUUID()`.
3. **Contextual Binding:** The correlation ID is automatically bound to the Pino logger context for all log entries generated during the request lifecycle.
4. **Header Echo:** The `x-correlation-id` is returned in the response headers and embedded within the `meta.correlationId` response envelope field.

---

## 5. OpenAPI / Swagger Documentation

1. **Automated Generation:** Fastify Swagger dynamically inspects registered route schemas and produces an OpenAPI 3.0 specification.
2. **Interactive UI:** Available in development and staging environments at `http://localhost:4000/docs`.
3. **Spec Export:** Available in raw JSON format at `http://localhost:4000/docs/json` for client SDK code generation.

