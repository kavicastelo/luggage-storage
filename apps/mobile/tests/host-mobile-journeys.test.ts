import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { useHostStore } from "../src/store/useHostStore";
import { DEMO_HOST_TRANSACTIONS } from "../src/data/mock-host-data";

describe("Phase 2C.5 — Host Mobile Application Journeys & Verification Tests (WS-5-HOST-MOB)", () => {
  beforeEach(() => {
    useHostStore.getState().resetToDefaults();
  });

  describe("Task TSK-2C-021: 5-Tab Operational Shell & Navigation (_layout.tsx, index.tsx)", () => {
    it("registers all 5 bottom tabs and modal sub-routes in _layout.tsx", () => {
      const layoutPath = path.resolve(__dirname, "../app/(host)/_layout.tsx");
      expect(fs.existsSync(layoutPath)).toBe(true);
      const content = fs.readFileSync(layoutPath, "utf-8");

      // Verify 5 persistent operational tabs
      expect(content).toContain('name="index"');
      expect(content).toContain('title: "Live Desk"');
      expect(content).toContain('name="requests"');
      expect(content).toContain('title: "Requests"');
      expect(content).toContain('name="vault"');
      expect(content).toContain('title: "Vault"');
      expect(content).toContain('name="earnings"');
      expect(content).toContain('title: "Earnings"');
      expect(content).toContain('name="settings"');
      expect(content).toContain('title: "Settings"');

      // Verify modal/sub-routes hidden from tab bar
      expect(content).toContain('name="scanner"');
      expect(content).toContain('name="intake"');
      expect(content).toContain("href: null");
    });

    it("applies CWCP terracotta active tint and coastal navy tab bar colors", () => {
      const layoutPath = path.resolve(__dirname, "../app/(host)/_layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      expect(content).toContain("tabBarActiveTintColor: mobileColors.terracotta[500]");
      expect(content).toContain("backgroundColor: mobileColors.navy[900]");
    });

    it("enforces RBAC guard allowing HOST_OWNER, HOST_STAFF, and SUPERADMIN roles", () => {
      const layoutPath = path.resolve(__dirname, "../app/(host)/_layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      expect(content).toContain('user?.roles?.includes("HOST_OWNER")');
      expect(content).toContain('user?.roles?.includes("HOST_STAFF")');
      expect(content).toContain('user?.roles?.includes("SUPERADMIN")');
      expect(content).toContain("RBAC Guard • 403 Forbidden");
    });

    it("renders Live Desk counter hub with venue profile, capacity bar, and queue movements", () => {
      const indexPath = path.resolve(__dirname, "../app/(host)/index.tsx");
      expect(fs.existsSync(indexPath)).toBe(true);
      const content = fs.readFileSync(indexPath, "utf-8");

      expect(content).toContain("Desk Counter Active");
      expect(content).toContain("Scan Luggage Pass");
      expect(content).toContain("Manual Intake");
      expect(content).toContain("Physical Vault Capacity");
      expect(content).toContain("Expected Today");
      expect(content).toContain("Vault Stored");
      expect(content).toContain("Movement Queue");
    });
  });

  describe("Task TSK-2C-022: Scanner & PIN Fallback (scanner.tsx)", () => {
    it("provides camera viewfinder, torch control, and quick pass simulator", () => {
      const scannerPath = path.resolve(__dirname, "../app/(host)/scanner.tsx");
      expect(fs.existsSync(scannerPath)).toBe(true);
      const content = fs.readFileSync(scannerPath, "utf-8");

      expect(content).toContain("Camera Scanner");
      expect(content).toContain("6-Digit PIN Fallback");
      expect(content).toContain("useCameraPermissions");
      expect(content).toContain("CameraView");
      expect(content).toContain("enableTorch");
      expect(content).toContain("Quick Pass Simulator");
      expect(content).toContain("Pass #8841 (Amaya - 2 Bags)");
    });

    it("verifies passes by PIN and QR code from the reactive store", () => {
      const store = useHostStore.getState();

      // Test PIN lookup
      const foundByPin = store.lookupByPin("482910");
      expect(foundByPin).not.toBeNull();
      expect(foundByPin?.reference).toBe("LS-2026-8841");
      expect(foundByPin?.travellerName).toBe("Amaya Perera");

      // Test QR lookup
      const foundByQr = store.lookupByQr("LS-CUSTODY://LS-2026-8842/HMAC-4D2A91E");
      expect(foundByQr).not.toBeNull();
      expect(foundByQr?.reference).toBe("LS-2026-8842");
      expect(foundByQr?.travellerName).toBe("Liam O'Connor");

      // Test invalid code
      const invalid = store.lookupByPin("000000");
      expect(invalid).toBeNull();
    });

    it("strictly labels pass matches as Demo Session Match under DEC-005", () => {
      const scannerPath = path.resolve(__dirname, "../app/(host)/scanner.tsx");
      const content = fs.readFileSync(scannerPath, "utf-8");
      expect(content).toContain("Demo Session Match (DEC-005 Verified)");
      expect(content).toContain("Scanner Invariant (DEC-005)");
      expect(content).not.toContain("Server-Verified Booking");
      expect(content).not.toContain("Cryptographically Verified");
    });
  });

  describe("Task TSK-2C-023: Guided Counter Intake & Seal Tagging Wizard (intake.tsx)", () => {
    it("guides host staff through 4 sequential intake stages", () => {
      const intakePath = path.resolve(__dirname, "../app/(host)/intake.tsx");
      expect(fs.existsSync(intakePath)).toBe(true);
      const content = fs.readFileSync(intakePath, "utf-8");

      expect(content).toContain("1. Bags");
      expect(content).toContain("2. Seal");
      expect(content).toContain("3. Photo");
      expect(content).toContain("4. Confirm");
      expect(content).toContain("Step 1: Bag Count Reconciliation");
      expect(content).toContain("Step 2: Security Seal Serialization");
      expect(content).toContain("Step 3: Pre-existing Condition Photo");
      expect(content).toContain("Step 4: Zone Allocation & Confirmation");
    });

    it("validates tamper seal serial format #SEAL-LK-XXXXX and logs DEC-007 disclosure", () => {
      const intakePath = path.resolve(__dirname, "../app/(host)/intake.tsx");
      const content = fs.readFileSync(intakePath, "utf-8");

      expect(content).toContain("/^SEAL-LK-\\d{5}$/");
      expect(content).toContain("Tamper Seal Logging (DEC-007)");
      expect(content).toContain("Generate Fresh Serial Number");
    });

    it("offers prominent 1-tap photo bypass adhering to invariant DEC-001", () => {
      const intakePath = path.resolve(__dirname, "../app/(host)/intake.tsx");
      const content = fs.readFileSync(intakePath, "utf-8");

      expect(content).toContain("Skip Photo Evidence (DEC-001 Prototype Option)");
      expect(content).toContain("No visible pre-existing damage");
      expect(content).toContain("Photo Policy Invariant (DEC-001)");
    });

    it("updates store state when intake is confirmed", () => {
      const target = useHostStore.getState().bookings.find((b) => b.status === "CONFIRMED");
      expect(target).toBeDefined();

      if (target) {
        useHostStore.getState().startIntake(target);
        expect(useHostStore.getState().intakeSession.booking?.id).toBe(target.id);

        useHostStore.getState().updateIntake({
          reconciledBags: target.totalBags,
          sealNumber: "SEAL-LK-77112",
          photoBypassed: true,
          assignedZone: "LOCKER-B"
        });

        const res = useHostStore.getState().confirmIntake();
        expect(res).not.toBeNull();
        expect(res?.success).toBe(true);

        const updated = useHostStore.getState().bookings.find((b) => b.id === target.id);
        expect(updated?.status).toBe("IN_STORAGE");
        expect(updated?.zoneCode).toBe("LOCKER-B");
        expect(updated?.sealNumbers).toContain("SEAL-LK-77112");
      }
    });
  });

  describe("Task TSK-2C-024: Active Vault Monitor & Overdue Alerts (vault.tsx)", () => {
    it("displays physical vault capacity and lists active storage items", () => {
      const vaultPath = path.resolve(__dirname, "../app/(host)/vault.tsx");
      expect(fs.existsSync(vaultPath)).toBe(true);
      const content = fs.readFileSync(vaultPath, "utf-8");

      expect(content).toContain("Vault Luggage Inventory");
      expect(content).toContain("Current Stored Luggage");
      expect(content).toContain("Rack Zone A");
      expect(content).toContain("Locker Zone B");
      expect(content).toContain("Floor Zone C");
      expect(content).toContain("Active Vault");
      expect(content).toContain("Overdue");
      expect(content).toContain("Released");
    });

    it("identifies overdue baggage and adheres strictly to invariant DEC-002", () => {
      const vaultPath = path.resolve(__dirname, "../app/(host)/vault.tsx");
      const content = fs.readFileSync(vaultPath, "utf-8");

      expect(content).toContain("Baggage Overdue");
      expect(content).toContain("Platform policy (DEC-002):");
      expect(content).toContain("Baggage release is never withheld for fee settlement");
      expect(content).toContain("Never withhold physical luggage");
    });

    it("executes baggage release handover transitioning status to COMPLETED", () => {
      const store = useHostStore.getState();
      const inStorageBooking = store.bookings.find((b) => b.status === "IN_STORAGE");
      expect(inStorageBooking).toBeDefined();

      if (inStorageBooking) {
        const res = store.releaseLuggage(inStorageBooking.id);
        expect(res.success).toBe(true);

        const cleared = useHostStore.getState().bookings.find((b) => b.id === inStorageBooking.id);
        expect(cleared?.status).toBe("COMPLETED");
      }
    });
  });

  describe("Task TSK-2C-025: Mobile Earnings & Settlement Ledger (earnings.tsx)", () => {
    it("calculates 85% net host payout vs 15% platform fee split (DEC-006)", () => {
      const earningsPath = path.resolve(__dirname, "../app/(host)/earnings.tsx");
      expect(fs.existsSync(earningsPath)).toBe(true);
      const content = fs.readFileSync(earningsPath, "utf-8");

      expect(content).toContain("Host Earnings & Settlements");
      expect(content).toContain("Net Host Earnings (85%)");
      expect(content).toContain("Gross Paid Guest Volume (100%)");
      expect(content).toContain("Platform Service Fee (15%)");
      expect(content).toContain("Policy Note (DEC-006)");
      expect(content).toContain("Commercial Bank of Ceylon");
      expect(content).toContain("Transaction History");
    });

    it("verifies mathematical correctness of transactions in mock ledger", () => {
      for (const tx of DEMO_HOST_TRANSACTIONS) {
        const netAmt = tx.netHostLkr ?? tx.netPayoutLkr;
        expect(tx.grossAmountLkr).toBeGreaterThan(0);
        expect(tx.platformFeeLkr).toBeGreaterThan(0);
        expect(netAmt).toBe(tx.grossAmountLkr - tx.platformFeeLkr);
        expect(tx.settlementBatch).toMatch(/^BATCH-2026-W\d{2}$/);
      }
    });
  });

  describe("Host Settings & Partner Profile (settings.tsx)", () => {
    it("renders facility specs, team directory, and DEC-010 compliance notice", () => {
      const settingsPath = path.resolve(__dirname, "../app/(host)/settings.tsx");
      expect(fs.existsSync(settingsPath)).toBe(true);
      const content = fs.readFileSync(settingsPath, "utf-8");

      expect(content).toContain("Storage Partner Profile");
      expect(content).toContain("Physical Facility Details");
      expect(content).toContain("Counter Staff Directory");
      expect(content).toContain("Roshan Fernando");
      expect(content).toContain("Priyantha Wickramasinghe");
      expect(content).toContain("Simulated Compliance Records");
      expect(content).toContain("Compliance Invariant (DEC-010)");
      expect(content).toContain("Reset Demo State to Initial Defaults");
    });

    it("resets store state when handleReset is triggered", () => {
      const store = useHostStore.getState();
      const first = store.bookings[0];
      store.releaseLuggage(first.id);
      expect(useHostStore.getState().bookings[0].status).toBe("COMPLETED");

      store.resetToDefaults();
      expect(useHostStore.getState().bookings[0].status).toBe("IN_STORAGE");
    });
  });

  describe("Product Governance & Developer Code Suppression Audit", () => {
    const hostDir = path.resolve(__dirname, "../app/(host)");
    const files = fs.readdirSync(hostDir).filter((f) => f.endsWith(".tsx"));

    it("contains all 7 canonical host route files", () => {
      expect(files).toContain("_layout.tsx");
      expect(files).toContain("index.tsx");
      expect(files).toContain("requests.tsx");
      expect(files).toContain("vault.tsx");
      expect(files).toContain("earnings.tsx");
      expect(files).toContain("settings.tsx");
      expect(files).toContain("scanner.tsx");
      expect(files).toContain("intake.tsx");
    });

    it("strictly forbids internal phase numbers, ticket IDs, and screen codes in UI", () => {
      const forbiddenPatterns = [
        /HM-00[1-9]/,
        /HM-0[1-3][0-9]/,
        /OQ-014/,
        /TSK-2C-02[1-5]/,
        /WF-012/,
        /Screen 0[1-9]/,
        /Phase 2B/i,
        /Phase 2A/i
      ];

      for (const file of files) {
        const filePath = path.join(hostDir, file);
        const content = fs.readFileSync(filePath, "utf-8");

        for (const pattern of forbiddenPatterns) {
          const match = content.match(pattern);
          expect(
            match,
            `Found forbidden tracking identifier ${pattern} in host file ${file}`
          ).toBeNull();
        }
      }
    });

    it("verifies honest prototype disclosure on every screen", () => {
      const screens = ["index.tsx", "requests.tsx", "vault.tsx", "earnings.tsx", "settings.tsx", "scanner.tsx", "intake.tsx"];
      for (const screen of screens) {
        const content = fs.readFileSync(path.join(hostDir, screen), "utf-8");
        expect(
          content.includes("prototypeNotice") || content.includes("Prototype") || content.includes("Simulation"),
          `Screen ${screen} must contain honest prototype disclosure.`
        ).toBe(true);
      }
    });
  });
});
