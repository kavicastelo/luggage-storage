/**
 * Mock Data & Fixtures for Phase 2C.5 Host Mobile Application (WS-5-HOST-MOB)
 *
 * Isolated, explicitly named demonstration fixtures.
 * Clearly separated from production data structures.
 *
 * NOTE: Payout schedule (DEC-006), Overdue fee policy (DEC-002),
 * and Photo evidence policy (DEC-001) remain PENDING PRODUCT OWNER SIGN-OFF.
 */

export interface DemoHostBooking {
  id: string;
  reference: string;
  travellerName: string;
  travellerCountry: string;
  travellerPhone?: string;
  status: "CONFIRMED" | "IN_STORAGE" | "OVERDUE" | "COMPLETED" | "CANCELLED";
  scheduledIntakeTime: string;
  scheduledPickupTime: string;
  dropOffTimestamp: number;
  pickUpTimestamp: number;
  bags: {
    SMALL: number;
    MEDIUM: number;
    LARGE: number;
    OVERSIZED: number;
  };
  totalBags: number;
  totalAmountLkr: number;
  hostNetPayoutLkr: number;
  platformFeeLkr: number;
  qrPayload: string;
  pinCode: string;
  sealNumbers: string[];
  zoneCode: string;
  photoEvidenceCaptured: boolean;
  notes?: string;
  overdueMinutes?: number;
  lateFeeLkr?: number;
  estimatedLateFeeLkr?: number;
}

export interface DemoHostHubInfo {
  id: string;
  name: string;
  city: string;
  district: string;
  address: string;
  proximityLandmark: string;
  operatingHours: string;
  totalCapacityBags: number;
  activeBagsInVault: number;
  zones: Array<{
    code: string;
    name: string;
    capacity: number;
    utilized: number;
  }>;
  supervisorName: string;
  supervisorPhone: string;
  primaryHostName?: string;
}

export interface DemoHostTransaction {
  id: string;
  bookingRef: string;
  reference?: string;
  date: string;
  timestamp?: string;
  travellerName: string;
  grossAmountLkr: number;
  platformFeeLkr: number;
  netPayoutLkr: number;
  netHostLkr?: number;
  settlementBatch: string;
  payoutBatchId?: string;
  status: "CLEARED" | "PENDING_BATCH";
  payoutStatus?: "CLEARED_BATCH" | "PENDING_SETTLEMENT";
}

export const DEMO_HOST_HUB: DemoHostHubInfo = {
  id: "loc-cmb-fort-01",
  name: "Colombo Fort Station Heritage Vault",
  city: "Colombo",
  district: "Western Province",
  address: "No. 48B Olcott Mawatha, Colombo 01",
  proximityLandmark: "120m from Colombo Fort Railway Station Entrance",
  operatingHours: "06:00 - 23:00 (Daily)",
  totalCapacityBags: 45,
  activeBagsInVault: 28,
  zones: [
    { code: "RACK-A", name: "Backroom Vault Rack A (Standard)", capacity: 25, utilized: 16 },
    { code: "LOCKER-B", name: "CCTV Monitored Lockers B", capacity: 12, utilized: 8 },
    { code: "FLOOR-C", name: "Ground Floor Oversized Zone C", capacity: 8, utilized: 4 }
  ],
  supervisorName: "Roshan Fernando",
  supervisorPhone: "+94 11 234 5678",
  primaryHostName: "Roshan Fernando"
};

export const DEMO_HOST_BOOKINGS: DemoHostBooking[] = [
  {
    id: "bkg-1001",
    reference: "LS-2026-8841",
    travellerName: "Amaya Perera",
    travellerPhone: "+94 77 123 4567",
    travellerCountry: "Sri Lanka",
    status: "IN_STORAGE",
    scheduledIntakeTime: "Today • 09:30 AM",
    scheduledPickupTime: "Today • 20:30 PM",
    dropOffTimestamp: 1794220200000,
    pickUpTimestamp: 1794259800000,
    bags: { SMALL: 1, MEDIUM: 2, LARGE: 0, OVERSIZED: 0 },
    totalBags: 3,
    totalAmountLkr: 3800,
    hostNetPayoutLkr: 3230,
    platformFeeLkr: 570,
    qrPayload: "LS-CUSTODY://LS-2026-8841/HMAC-9F8A72B",
    pinCode: "482910",
    sealNumbers: ["SEAL-LK-90211", "SEAL-LK-90212", "SEAL-LK-90213"],
    zoneCode: "RACK-A",
    photoEvidenceCaptured: true,
    notes: "Fragile tea parcels inside medium suitcase."
  },
  {
    id: "bkg-1002",
    reference: "LS-2026-8842",
    travellerName: "Liam O'Connor",
    travellerPhone: "+353 87 234 5678",
    travellerCountry: "Ireland",
    status: "OVERDUE",
    scheduledIntakeTime: "Today • 10:15 AM",
    scheduledPickupTime: "Today • 17:30 PM",
    dropOffTimestamp: 1794222900000,
    pickUpTimestamp: 1794249000000,
    bags: { SMALL: 0, MEDIUM: 1, LARGE: 1, OVERSIZED: 0 },
    totalBags: 2,
    totalAmountLkr: 3100,
    hostNetPayoutLkr: 2635,
    platformFeeLkr: 465,
    qrPayload: "LS-CUSTODY://LS-2026-8842/HMAC-4D2A91E",
    pinCode: "739204",
    sealNumbers: ["SEAL-LK-90214", "SEAL-LK-90215"],
    zoneCode: "LOCKER-B",
    photoEvidenceCaptured: true,
    overdueMinutes: 90,
    lateFeeLkr: 650,
    estimatedLateFeeLkr: 650,
    notes: "Train delayed from Kandy. Guest contacted desk via chat."
  },
  {
    id: "bkg-1003",
    reference: "LS-2026-8843",
    travellerName: "Nadeesha Silva",
    travellerPhone: "+94 71 456 7890",
    travellerCountry: "Sri Lanka",
    status: "CONFIRMED",
    scheduledIntakeTime: "Today • 19:15 PM",
    scheduledPickupTime: "Tomorrow • 10:00 AM",
    dropOffTimestamp: 1794255300000,
    pickUpTimestamp: 1794308400000,
    bags: { SMALL: 2, MEDIUM: 0, LARGE: 0, OVERSIZED: 0 },
    totalBags: 2,
    totalAmountLkr: 2900,
    hostNetPayoutLkr: 2465,
    platformFeeLkr: 435,
    qrPayload: "LS-CUSTODY://LS-2026-8843/HMAC-1A8C93F",
    pinCode: "661928",
    sealNumbers: [],
    zoneCode: "RACK-A",
    photoEvidenceCaptured: false,
    notes: "Two compact backpacks."
  },
  {
    id: "bkg-1004",
    reference: "LS-2026-8835",
    travellerName: "Henrik Lindqvist",
    travellerPhone: "+46 70 123 4567",
    travellerCountry: "Sweden",
    status: "CONFIRMED",
    scheduledIntakeTime: "Today • 19:45 PM",
    scheduledPickupTime: "Tomorrow • 18:00 PM",
    dropOffTimestamp: 1794257100000,
    pickUpTimestamp: 1794337200000,
    bags: { SMALL: 1, MEDIUM: 1, LARGE: 1, OVERSIZED: 1 },
    totalBags: 4,
    totalAmountLkr: 4450,
    hostNetPayoutLkr: 3782,
    platformFeeLkr: 668,
    qrPayload: "LS-CUSTODY://LS-2026-8835/HMAC-7F1B34C",
    pinCode: "194820",
    sealNumbers: [],
    zoneCode: "FLOOR-C",
    photoEvidenceCaptured: false,
    notes: "Oversized surfboard bag included."
  },
  {
    id: "bkg-1005",
    reference: "LS-2026-8810",
    travellerName: "Kasun Jayasuriya",
    travellerPhone: "+94 77 987 6543",
    travellerCountry: "Sri Lanka",
    status: "COMPLETED",
    scheduledIntakeTime: "Today • 08:00 AM",
    scheduledPickupTime: "Today • 15:30 PM",
    dropOffTimestamp: 1794214800000,
    pickUpTimestamp: 1794241800000,
    bags: { SMALL: 1, MEDIUM: 0, LARGE: 0, OVERSIZED: 0 },
    totalBags: 1,
    totalAmountLkr: 1760,
    hostNetPayoutLkr: 1496,
    platformFeeLkr: 264,
    qrPayload: "LS-CUSTODY://LS-2026-8810/COMPLETED",
    pinCode: "552109",
    sealNumbers: ["SEAL-LK-90209"],
    zoneCode: "RACK-A",
    photoEvidenceCaptured: true,
    notes: "Released to guest in good condition."
  },
  {
    id: "bkg-1006",
    reference: "LS-2026-8799",
    travellerName: "Sophie Laurent",
    travellerPhone: "+33 6 12 34 56 78",
    travellerCountry: "France",
    status: "COMPLETED",
    scheduledIntakeTime: "Yesterday • 14:00 PM",
    scheduledPickupTime: "Today • 14:15 PM",
    dropOffTimestamp: 1794150000000,
    pickUpTimestamp: 1794237300000,
    bags: { SMALL: 0, MEDIUM: 2, LARGE: 1, OVERSIZED: 0 },
    totalBags: 3,
    totalAmountLkr: 15980,
    hostNetPayoutLkr: 13583,
    platformFeeLkr: 2397,
    qrPayload: "LS-CUSTODY://LS-2026-8799/COMPLETED",
    pinCode: "992814",
    sealNumbers: ["SEAL-LK-90188", "SEAL-LK-90189", "SEAL-LK-90190"],
    zoneCode: "LOCKER-B",
    photoEvidenceCaptured: true,
    notes: "Multi-day storage completed."
  }
];

export const DEMO_HOST_TRANSACTIONS: DemoHostTransaction[] = [
  {
    id: "tx-2026-001",
    bookingRef: "LS-2026-8810",
    reference: "LS-2026-8810",
    date: "Today • 15:35",
    timestamp: "Today • 15:35",
    travellerName: "Kasun Jayasuriya",
    grossAmountLkr: 1760,
    platformFeeLkr: 264,
    netPayoutLkr: 1496,
    netHostLkr: 1496,
    settlementBatch: "BATCH-2026-W45",
    payoutBatchId: "BATCH-2026-W45",
    status: "PENDING_BATCH",
    payoutStatus: "PENDING_SETTLEMENT"
  },
  {
    id: "tx-2026-002",
    bookingRef: "LS-2026-8799",
    reference: "LS-2026-8799",
    date: "Today • 14:20",
    timestamp: "Today • 14:20",
    travellerName: "Sophie Laurent",
    grossAmountLkr: 15980,
    platformFeeLkr: 2397,
    netPayoutLkr: 13583,
    netHostLkr: 13583,
    settlementBatch: "BATCH-2026-W45",
    payoutBatchId: "BATCH-2026-W45",
    status: "PENDING_BATCH",
    payoutStatus: "PENDING_SETTLEMENT"
  },
  {
    id: "tx-2026-003",
    bookingRef: "LS-2026-8750",
    reference: "LS-2026-8750",
    date: "06 Nov 2026",
    timestamp: "06 Nov 2026",
    travellerName: "Michael Chang",
    grossAmountLkr: 4800,
    platformFeeLkr: 720,
    netPayoutLkr: 4080,
    netHostLkr: 4080,
    settlementBatch: "BATCH-2026-W44",
    payoutBatchId: "BATCH-2026-W44",
    status: "CLEARED",
    payoutStatus: "CLEARED_BATCH"
  },
  {
    id: "tx-2026-004",
    bookingRef: "LS-2026-8742",
    reference: "LS-2026-8742",
    date: "05 Nov 2026",
    timestamp: "05 Nov 2026",
    travellerName: "Elena Rostova",
    grossAmountLkr: 3200,
    platformFeeLkr: 480,
    netPayoutLkr: 2720,
    netHostLkr: 2720,
    settlementBatch: "BATCH-2026-W44",
    payoutBatchId: "BATCH-2026-W44",
    status: "CLEARED",
    payoutStatus: "CLEARED_BATCH"
  },
  {
    id: "tx-2026-005",
    bookingRef: "LS-2026-8711",
    reference: "LS-2026-8711",
    date: "04 Nov 2026",
    timestamp: "04 Nov 2026",
    travellerName: "Ruwan Wickrama",
    grossAmountLkr: 2500,
    platformFeeLkr: 375,
    netPayoutLkr: 2125,
    netHostLkr: 2125,
    settlementBatch: "BATCH-2026-W44",
    payoutBatchId: "BATCH-2026-W44",
    status: "CLEARED",
    payoutStatus: "CLEARED_BATCH"
  }
];

export const DEMO_PIN_LOOKUPS: Record<string, DemoHostBooking> = {
  "482910": DEMO_HOST_BOOKINGS[0],
  "739204": DEMO_HOST_BOOKINGS[1],
  "661928": DEMO_HOST_BOOKINGS[2],
  "194820": DEMO_HOST_BOOKINGS[3]
};

export const DEMO_QR_LOOKUPS: Record<string, DemoHostBooking> = {
  "LS-CUSTODY://LS-2026-8841/HMAC-9F8A72B": DEMO_HOST_BOOKINGS[0],
  "LS-CUSTODY://LS-2026-8842/HMAC-4D2A91E": DEMO_HOST_BOOKINGS[1],
  "LS-CUSTODY://LS-2026-8843/HMAC-1A8C93F": DEMO_HOST_BOOKINGS[2],
  "LS-CUSTODY://LS-2026-8835/HMAC-7F1B34C": DEMO_HOST_BOOKINGS[3]
};
