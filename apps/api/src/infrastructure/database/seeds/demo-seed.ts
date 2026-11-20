import { sql } from "drizzle-orm";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import crypto from "node:crypto";
import { env } from "../../../config/env.js";
import { Argon2Service } from "../../../modules/auth/argon2.service.js";
import * as schema from "../schema/index.js";
import {
  CUSTODY_HASH_VERSION,
  computeCustodyCredentialHmac
} from "../../../common/crypto/custody-hmac.js";

const { Pool } = pg;

export interface SeedResult {
  usersCount: number;
  businessesCount: number;
  locationsCount: number;
  bookingsCount: number;
}

export async function seedDemoData(): Promise<SeedResult> {
  const migratorPool = new Pool({
    connectionString: env.MIGRATION_DATABASE_URL
  });
  const db = drizzle(migratorPool, { schema });

  try {
    const argon2 = new Argon2Service();
    const defaultPasswordHash = await argon2.hashPassword("DemoPassword123!");

    console.log("🌱 [Demo Seeder] Starting idempotent marketplace demo seeding...");

  // 1. Fetch system roles
  const rolesList = await db.select().from(schema.roles);
  const roleMap = new Map<string, string>();
  for (const r of rolesList) {
    roleMap.set(r.code, r.id);
  }

  // Ensure standard roles exist
  if (!roleMap.has("SUPERADMIN") || !roleMap.has("HOST_OWNER")) {
    console.log("⚠️ Roles table missing system roles. Ensuring standard roles...");
    await db.execute(sql`
      INSERT INTO "roles" (code, name, description, is_system)
      VALUES 
        ('SUPERADMIN', 'Super Administrator', 'Full platform governance', true),
        ('SUPPORT', 'Customer Support', 'Support agent', true),
        ('HOST_OWNER', 'Host Owner', 'Host business owner', true),
        ('HOST_STAFF', 'Host Staff', 'Location attendant', true),
        ('TRAVELLER', 'Traveller', 'Registered traveller', true)
      ON CONFLICT (code) DO NOTHING;
    `);
    const refreshed = await db.select().from(schema.roles);
    for (const r of refreshed) {
      roleMap.set(r.code, r.id);
    }
  }

  // Ensure default role permissions are mapped
  try {
    const { rbacService } = await import("../../../modules/auth/rbac.service.js");
    await rbacService.ensureDefaultRolePermissions();
    console.log("✅ [Demo Seeder] Standard RBAC permissions verified and populated.");
  } catch (rbacErr) {
    console.warn("⚠️ [Demo Seeder] RBAC permissions seeding warning:", rbacErr);
  }

  // 2. Demo Users Specification
  const demoUsersSpec = [
    {
      email: "superadmin@luggagevault.lk",
      displayName: "Super Administrator",
      phoneNumber: "+94770000001",
      roleCode: "SUPERADMIN"
    },
    {
      email: "support@luggagevault.lk",
      displayName: "Support Officer",
      phoneNumber: "+94770000002",
      roleCode: "SUPPORT"
    },
    {
      email: "host.colombo@luggagevault.lk",
      displayName: "Colombo Host Partner",
      phoneNumber: "+94770000010",
      roleCode: "HOST_OWNER"
    },
    {
      email: "host.kandy@luggagevault.lk",
      displayName: "Kandy Host Partner",
      phoneNumber: "+94770000011",
      roleCode: "HOST_OWNER"
    },
    {
      email: "host.galle@luggagevault.lk",
      displayName: "Galle Fort Host",
      phoneNumber: "+94770000012",
      roleCode: "HOST_OWNER"
    },
    {
      email: "staff.colombo@luggagevault.lk",
      displayName: "Colombo Hub Attendant",
      phoneNumber: "+94770000020",
      roleCode: "HOST_STAFF"
    },
    {
      email: "traveller.elena@luggagevault.lk",
      displayName: "Elena Rostova",
      phoneNumber: "+94770000030",
      roleCode: "TRAVELLER"
    },
    {
      email: "traveller.john@luggagevault.lk",
      displayName: "Johnathan Davis",
      phoneNumber: "+94770000031",
      roleCode: "TRAVELLER"
    }
  ];

  const userIds = new Map<string, string>();

  for (const u of demoUsersSpec) {
    const normalized = u.email.toLowerCase().trim();
    const existing = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(sql`${schema.users.normalizedEmail} = ${normalized}`);

    let uid: string;
    if (existing.length > 0) {
      uid = existing[0].id;
      await db
        .update(schema.users)
        .set({
          displayName: u.displayName,
          passwordHash: defaultPasswordHash,
          status: "ACTIVE",
          isEmailVerified: true,
          emailVerifiedAt: new Date()
        })
        .where(sql`${schema.users.id} = ${uid}`);
    } else {
      const inserted = await db
        .insert(schema.users)
        .values({
          email: u.email,
          normalizedEmail: normalized,
          passwordHash: defaultPasswordHash,
          displayName: u.displayName,
          phoneNumber: u.phoneNumber,
          status: "ACTIVE",
          isEmailVerified: true,
          emailVerifiedAt: new Date()
        })
        .returning({ id: schema.users.id });
      uid = inserted[0].id;
    }
    userIds.set(normalized, uid);

    // Assign role
    const roleId = roleMap.get(u.roleCode);
    if (roleId) {
      await db.execute(sql`
        INSERT INTO "user_roles" (user_id, role_id)
        VALUES (${uid}, ${roleId})
        ON CONFLICT (user_id, role_id) DO NOTHING;
      `);
    }

    // Assign traveller profile
    await db.execute(sql`
      INSERT INTO "traveller_profiles" (user_id, preferred_currency)
      VALUES (${uid}, 'LKR')
      ON CONFLICT DO NOTHING;
    `);
  }

  // 3. Host Businesses Specification
  const businessesSpec = [
    {
      ownerEmail: "host.colombo@luggagevault.lk",
      legalName: "Lanka Vault Colombo Central Pvt Ltd",
      tradeName: "Colombo Central Vaults",
      contactEmail: "colombo@luggagevault.lk",
      contactPhone: "+94112345678",
      city: "Colombo",
      address: "No. 45, Olcott Mawatha, Colombo 11"
    },
    {
      ownerEmail: "host.kandy@luggagevault.lk",
      legalName: "Hill Country Luggage Haven",
      tradeName: "Kandy Transit Vaults",
      contactEmail: "kandy@luggagevault.lk",
      contactPhone: "+94812345678",
      city: "Kandy",
      address: "Station Road, Kandy Central"
    },
    {
      ownerEmail: "host.galle@luggagevault.lk",
      legalName: "Galle Heritage Storage Services",
      tradeName: "Galle Fort Luggage Lockers",
      contactEmail: "galle@luggagevault.lk",
      contactPhone: "+94912345678",
      city: "Galle",
      address: "Church Street, Galle Fort"
    }
  ];

  const businessIds = new Map<string, string>();

  for (const b of businessesSpec) {
    const ownerId = userIds.get(b.ownerEmail)!;
    const existing = await db
      .select({ id: schema.hostBusinesses.id })
      .from(schema.hostBusinesses)
      .where(sql`${schema.hostBusinesses.ownerUserId} = ${ownerId}`);

    let bid: string;
    if (existing.length > 0) {
      bid = existing[0].id;
      await db
        .update(schema.hostBusinesses)
        .set({
          legalBusinessName: b.legalName,
          tradeName: b.tradeName,
          status: "ACTIVE"
        })
        .where(sql`${schema.hostBusinesses.id} = ${bid}`);
    } else {
      const inserted = await db
        .insert(schema.hostBusinesses)
        .values({
          ownerUserId: ownerId,
          legalBusinessName: b.legalName,
          tradeName: b.tradeName,
          contactEmail: b.contactEmail,
          contactPhone: b.contactPhone,
          city: b.city,
          addressLine1: b.address,
          status: "ACTIVE"
        })
        .returning({ id: schema.hostBusinesses.id });
      bid = inserted[0].id;
    }
    businessIds.set(b.ownerEmail, bid);
  }

  // 4. Storage Locations Specification (with validated Sri Lanka PostGIS Point coordinates)
  const locationsSpec = [
    {
      ownerEmail: "host.colombo@luggagevault.lk",
      name: "Colombo Fort Station Central Vault",
      description: "Secure indoor luggage storage facility 2 minutes walk from Colombo Fort Railway Station and Pettah bus terminal.",
      address: "45 Olcott Mawatha",
      city: "Colombo",
      latitude: 6.9344,
      longitude: 79.8519,
      baseRateMinor: 150000 // 1,500 LKR
    },
    {
      ownerEmail: "host.kandy@luggagevault.lk",
      name: "Kandy Railway Station Transit Lockers",
      description: "Convenient left-luggage facility directly facing Kandy Central Railway Station with CCTV and 24/7 security attendant.",
      address: "12 Station Approach Road",
      city: "Kandy",
      latitude: 7.2906,
      longitude: 80.6337,
      baseRateMinor: 120000 // 1,200 LKR
    },
    {
      ownerEmail: "host.galle@luggagevault.lk",
      name: "Galle Fort Heritage Locker Vault",
      description: "Climate-controlled baggage storage located inside UNESCO World Heritage Galle Fort near Main Gate.",
      address: "18 Church Street",
      city: "Galle",
      latitude: 6.0328,
      longitude: 80.217,
      baseRateMinor: 140000 // 1,400 LKR
    },
    {
      ownerEmail: "host.colombo@luggagevault.lk",
      name: "Negombo Transit Hub Locker Facility",
      description: "Quick 15-minute transfer from Bandaranaike International Airport (CMB) with luggage drop and private changing rooms.",
      address: "78 Lewis Place",
      city: "Negombo",
      latitude: 7.2083,
      longitude: 79.8358,
      baseRateMinor: 130000 // 1,300 LKR
    }
  ];

  const locationIds = new Map<string, string>();

  for (const loc of locationsSpec) {
    const bid = businessIds.get(loc.ownerEmail)!;
    const pointWkt = `SRID=4326;POINT(${loc.longitude} ${loc.latitude})`;

    const existing = await db
      .select({ id: schema.storageLocations.id })
      .from(schema.storageLocations)
      .where(sql`${schema.storageLocations.name} = ${loc.name}`);

    let lid: string;
    if (existing.length > 0) {
      lid = existing[0].id;
      await db
        .update(schema.storageLocations)
        .set({
          status: "ACTIVE",
          latitude: loc.latitude,
          longitude: loc.longitude,
          coordinates: pointWkt,
          coarseCoordinates: pointWkt
        })
        .where(sql`${schema.storageLocations.id} = ${lid}`);
    } else {
      const inserted = await db
        .insert(schema.storageLocations)
        .values({
          businessId: bid,
          name: loc.name,
          description: loc.description,
          addressLine1: loc.address,
          city: loc.city,
          latitude: loc.latitude,
          longitude: loc.longitude,
          coordinates: pointWkt,
          coarseCoordinates: pointWkt,
          bookingMode: "INSTANT",
          status: "ACTIVE"
        })
        .returning({ id: schema.storageLocations.id });
      lid = inserted[0].id;
    }
    locationIds.set(loc.name, lid);

    // Opening Hours (7 days, 06:00 - 22:00)
    for (let day = 1; day <= 7; day++) {
      await db.execute(sql`
        INSERT INTO "opening_hours" (location_id, day_of_week, open_time, close_time, allows_dropoff, allows_collection, is_closed)
        VALUES (${lid}, ${day}, '06:00', '22:00', true, true, false)
        ON CONFLICT (location_id, day_of_week) DO UPDATE
        SET open_time = '06:00', close_time = '22:00', is_closed = false;
      `);
    }

    // Capacity pool (50 units)
    await db.execute(sql`
      INSERT INTO "storage_capacity_pools" (location_id, pool_type, total_units, is_active)
      VALUES (${lid}, 'SHARED', 50, true)
      ON CONFLICT DO NOTHING;
    `);

    // Pricing Policy (ACTIVE)
    await db.execute(sql`
      INSERT INTO "pricing_policies" (location_id, currency, pricing_unit, base_rate_minor, status)
      VALUES (${lid}, 'LKR', 'CALENDAR_DAY', ${loc.baseRateMinor}, 'ACTIVE')
      ON CONFLICT (location_id) WHERE status = 'ACTIVE' DO UPDATE
      SET base_rate_minor = ${loc.baseRateMinor};
    `);
  }

  // 5. Active Demo Booking with Custody Record
  const colomboLocId = locationIds.get("Colombo Fort Station Central Vault")!;
  const elenaId = userIds.get("traveller.elena@luggagevault.lk")!;

  const existingBooking = await db
    .select({ id: schema.bookings.id })
    .from(schema.bookings)
    .where(sql`${schema.bookings.referenceCode} = 'DEMO-COLOMBO-001'`);

  let bookingId: string;
  if (existingBooking.length > 0) {
    bookingId = existingBooking[0].id;
  } else {
    const dropoffDate = new Date();
    const pickupDate = new Date(Date.now() + 24 * 3600 * 1000);

    const colomboBizId = businessIds.get("host.colombo@luggagevault.lk")!;
    const insertedBooking = await db
      .insert(schema.bookings)
      .values({
        referenceCode: "DEMO-COLOMBO-001",
        travellerUserId: elenaId,
        businessId: colomboBizId,
        locationId: colomboLocId,
        bookingMode: "INSTANT",
        status: "CONFIRMED",
        currency: "LKR",
        totalAmountMinor: 165000,
        dropOffAt: dropoffDate,
        collectionAt: pickupDate,
        totalBags: 2,
        totalCapacityUnits: 2,
        confirmedAt: new Date()
      })
      .returning({ id: schema.bookings.id });
    bookingId = insertedBooking[0].id;

    // Insert booking luggage items
    await db.insert(schema.bookingItems).values([
      {
        bookingId,
        bagCategory: "BAG_LARGE",
        quantity: 1,
        capacityUnits: 1,
        unitRateMinor: 100000,
        lineTotalMinor: 100000
      },
      {
        bookingId,
        bagCategory: "BAG_MEDIUM",
        quantity: 1,
        capacityUnits: 1,
        unitRateMinor: 65000,
        lineTotalMinor: 65000
      }
    ]);

    // Insert successful Payment Intent
    await db.insert(schema.paymentIntents).values({
      bookingId,
      travellerUserId: elenaId,
      amountMinor: 165000,
      currency: "LKR",
      provider: "STRIPE",
      providerOrderId: "pi_demo_colombo_001_succeeded",
      status: "SUCCEEDED",
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      verifiedAt: new Date()
    });

    // Insert Custody Record (1:1 with booking)
    const [custody] = await db
      .insert(schema.custodyRecords)
      .values({
        bookingId,
        locationId: colomboLocId,
        businessId: businessIds.get("host.colombo@luggagevault.lk")!,
        status: "EXPECTED",
        expectedBagCount: 2
      })
      .returning({ id: schema.custodyRecords.id });

    // Issue demo active custody QR token and 6-digit PIN
    const qrToken = crypto.randomBytes(32).toString("hex");
    const verificationPin = "123456";
    const tokenHash = computeCustodyCredentialHmac({
      purpose: "CUSTODY_QR",
      bookingId,
      operation: "CHECK_IN",
      credential: qrToken
    });
    const pinHash = computeCustodyCredentialHmac({
      purpose: "CUSTODY_PIN",
      bookingId,
      operation: "CHECK_IN",
      credential: verificationPin
    });

    await db.insert(schema.custodyTokens).values({
      custodyRecordId: custody.id,
      bookingId,
      operation: "CHECK_IN",
      hashVersion: CUSTODY_HASH_VERSION,
      tokenHash,
      pinHash,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000)
    });
  }

  console.log(`✅ [Demo Seeder] Seeding finished successfully!
     - Users: ${demoUsersSpec.length} (Default Password: DemoPassword123!)
     - Host Businesses: ${businessesSpec.length}
     - Storage Locations: ${locationsSpec.length}
     - Demo Booking: DEMO-COLOMBO-001 (Elena Rostova at Colombo Fort Central Vault)`);

    return {
      usersCount: demoUsersSpec.length,
      businessesCount: businessesSpec.length,
      locationsCount: locationsSpec.length,
      bookingsCount: 1
    };
  } finally {
    await migratorPool.end();
  }
}

export async function resetDatabase(): Promise<void> {
  console.log("⚠️ [Demo Seeder] Resetting database tables...");
  const migratorPool = new Pool({
    connectionString: env.MIGRATION_DATABASE_URL
  });

  try {
    await migratorPool.query(`
      TRUNCATE TABLE
        "bag_custody_items",
        "custody_tokens",
        "custody_records",
        "payment_webhook_events",
        "payment_transactions",
        "payment_intents",
        "booking_items",
        "bookings",
        "storage_capacity_pools",
        "pricing_policies",
        "opening_hours_exceptions",
        "opening_hours",
        "location_media",
        "storage_zones",
        "storage_locations",
        "host_staff_memberships",
        "host_verification_documents",
        "host_verifications",
        "host_businesses",
        "traveller_profiles",
        "host_profiles",
        "user_roles",
        "auth_sessions",
        "security_audit_events"
      CASCADE;
    `);
    console.log("🧹 [Demo Seeder] Operational tables truncated.");
  } finally {
    await migratorPool.end();
  }

  await seedDemoData();
}

// CLI execution check
if (process.argv[1] && process.argv[1].includes("demo-seed")) {
  const isReset = process.argv.includes("--reset");
  const action = isReset ? resetDatabase() : seedDemoData();
  action
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seed failed:", err);
      process.exit(1);
    });
}
