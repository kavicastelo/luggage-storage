/**
 * Global Database Lock Acquisition Order & Safe Deadlock/Serialization Retry Helper (Remediations B3/B4)
 *
 * Canonical lock acquisition hierarchy across all multi-table transactions touching Phase B entities:
 *   1. `storage_capacity_pools` (ORDER BY id ASC FOR UPDATE) — only when creating capacity allocations
 *   2. `bookings` (FOR UPDATE)
 *   3. `payment_intents` (ORDER BY id ASC FOR UPDATE)
 *   4. `refund_records` / `custody_records` / `custody_tokens` (ORDER BY id ASC FOR UPDATE)
 *   5. `host_payables` / append-only inserts (`financial_ledger_entries`, `payment_transactions`,
 *      `payment_webhook_events`, `booking_status_history`, `custody_events`, `security_audit_events`)
 */

const RETRYABLE_PG_SQLSTATES = new Set(["40P01", "40001"]);

function extractPgSqlState(err: unknown): string | undefined {
  let current: unknown = err;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    const obj = current as { code?: unknown; cause?: unknown };
    if (typeof obj.code === "string" && RETRYABLE_PG_SQLSTATES.has(obj.code)) {
      return obj.code;
    }
    current = obj.cause;
  }
  return undefined;
}

export function isRetryablePgError(err: unknown): boolean {
  return extractPgSqlState(err) !== undefined;
}

/**
 * Executes a pure PostgreSQL transaction callback with bounded retry ONLY for
 * transient PostgreSQL deadlock (`40P01`) or serialization failure (`40001`).
 * Never retries application/validation errors or external network I/O.
 */
export async function withSerializableOrDeadlockRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 2
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (err) {
      const pgCode = extractPgSqlState(err);
      if (!pgCode || attempt >= maxRetries) {
        throw err;
      }
      attempt++;
      const jitterMs = Math.floor(Math.random() * 15);
      await new Promise((resolve) => setTimeout(resolve, 15 * attempt + jitterMs));
    }
  }
}
