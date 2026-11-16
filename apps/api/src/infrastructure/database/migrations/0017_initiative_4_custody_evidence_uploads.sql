-- Initiative 4: Custody evidence photo upload purpose & HOST_STAFF upload initiation grant

ALTER TABLE "upload_intents" DROP CONSTRAINT IF EXISTS "upload_intents_purpose_check";
--> statement-breakpoint

ALTER TABLE "upload_intents"
  ADD CONSTRAINT "upload_intents_purpose_check"
  CHECK ("purpose" IN ('HOST_VERIFICATION', 'LOCATION_IMAGE', 'CUSTODY_EVIDENCE'));
--> statement-breakpoint

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" = 'HOST_STAFF'
  AND p."code" = 'upload.initiate'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
