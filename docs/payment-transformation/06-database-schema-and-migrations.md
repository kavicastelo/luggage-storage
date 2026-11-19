# Database Schema and Migrations

**Project:** Luggage Storage Marketplace (`kavicastelo/luggage-storage`)  
**Document:** `docs/payment-transformation/06-database-schema-and-migrations.md`  
**Initiative:** Payment Infrastructure Transformation  
**Status:** Approved Technical Migration Plan  

---

## 1. Migration Strategy Overview

The database transformation updates PostgreSQL 16 + PostGIS schema through a single **forward-only SQL migration**:

`apps/api/src/infrastructure/database/migrations/0019_payment_infrastructure_transformation.sql`

### Strict Integrity Directives:
1. **Never Drop Historical Data:** Zero deletion of historical rows in `payment_intents`, `payment_transactions`, `payment_webhook_events`, `refund_records`, or `financial_ledger_entries`.
2. **Preserve Legacy Enums in Storage:** `provider = 'PAYHERE'` remains valid in database constraints for queryability and audit history.
3. **Preserve Foreign Keys & Indexes:** Maintain existing indexes on `(booking_id)`, `(provider_order_id)`, and `(provider, event_id)`.

---

## 2. Detailed Schema Changes

### 2.1 Updating `payment_intents` Provider Check Constraint
In `schema/payments.ts`, the existing constraint:
```sql
ALTER TABLE "payment_intents"
  DROP CONSTRAINT IF EXISTS "payment_intents_provider_check";

ALTER TABLE "payment_intents"
  ADD CONSTRAINT "payment_intents_provider_check"
  CHECK ("provider" IN ('SANDBOX_GATEWAY', 'PAYHERE', 'STRIPE', 'PAYPAL'));
```

### 2.2 Updating `payment_intents_payhere_channel_active_check`
The existing constraint verifies that active PayHere intents do not have legacy `mobileHandoffPath`:
```sql
ALTER TABLE "payment_intents"
  DROP CONSTRAINT IF EXISTS "payment_intents_payhere_channel_active_check";

ALTER TABLE "payment_intents"
  ADD CONSTRAINT "payment_intents_payhere_channel_active_check"
  CHECK (
    "provider" <> 'PAYHERE'
    OR "status" NOT IN ('INITIATED', 'PENDING_GATEWAY')
    OR NOT ("checkout_payload" ? 'mobileHandoffPath')
  );
```
This ensures new intents using `STRIPE` or `PAYPAL` are never restricted by PayHere payload rules, while legacy PayHere intents remain valid.

### 2.3 Currency Normalization
All existing currency columns:
- `payment_intents.currency` (`varchar(3)`)
- `payment_transactions.currency` (`varchar(3)`)
- `refund_records.currency` (`varchar(3)`)
- `financial_ledger_entries.currency` (`varchar(3)`)
- `host_payables.currency` (`varchar(3)`)

Are already 3-character varchar columns compatible with ISO 4217 standard codes (`USD`, `EUR`, `GBP`, `LKR`, `AUD`, `CAD`, `SGD`, `JPY`). The default remains `'LKR'` for backward compatibility, while new bookings store their actual transaction currency.

---

## 3. Migration Rollback & Recovery Verification

1. **Advisory Locking:** All migrations run within Drizzle's migration engine under `pg_advisory_lock` with role `luggage_migrator`.
2. **Rollback Strategy:** Should a rollback be required during pre-production verification, forward-only corrective migrations are applied. Column alterations do not drop columns or rewrite existing data.
3. **Journal Tracking:** `apps/api/src/infrastructure/database/migrations/meta/_journal.json` is incremented to index `19`.
4. **Parity Testing:** `apps/api/tests/stabilization-security.test.ts` validates that all migration files and snapshots match the live schema definitions.

