import { MascotKey } from "@/lib/mascots";

export type ScreenSurface = "TM" | "HM" | "PW" | "HD" | "AD";

export interface RegisteredScreenSpec {
  id: string;
  surface: ScreenSurface;
  name: string;
  route: string;
  actorScope: string;
  workflows: string[];
  mascot?: MascotKey;
  backendDependency: "LIVE_PHASE_1B" | "HYBRID_PREVIEW" | "UI_SIMULATION";
}

export const RESERVED_SCREEN_IDS = [
  "TM-009",
  "TM-010",
  "TM-025",
  "TM-026",
  "TM-038",
  "HM-008",
  "HM-012",
  "HM-015",
  "HM-016",
  "HM-017",
  "HM-032"
] as const;

export const WEB_PUBLIC_SCREENS: RegisteredScreenSpec[] = [
  {
    id: "PW-001",
    surface: "PW",
    name: "Public Landing Page",
    route: "/",
    actorScope: "Public / Traveller",
    workflows: ["WF-007"],
    mascot: "wave",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "PW-002",
    surface: "PW",
    name: "Web Search & Discovery",
    route: "/search",
    actorScope: "Public / Traveller",
    workflows: ["WF-007", "WF-008"],
    mascot: "map",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "PW-003",
    surface: "PW",
    name: "Location Profile Detail",
    route: "/locations/:slug",
    actorScope: "Public / Traveller",
    workflows: ["WF-009"],
    mascot: "suitcase-hug",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "PW-004",
    surface: "PW",
    name: "Web Checkout & Schedule",
    route: "/checkout/:locId",
    actorScope: "Traveller",
    workflows: ["WF-017", "WF-018"],
    mascot: "blank-tag",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "PW-005",
    surface: "PW",
    name: "Web Payment & Confirmation",
    route: "/booking/confirm",
    actorScope: "Traveller",
    workflows: ["WF-019", "WF-020", "WF-021"],
    mascot: "jump",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "PW-006",
    surface: "PW",
    name: "Become a Host Landing",
    route: "/become-a-host",
    actorScope: "Public / Prospective Host",
    workflows: ["WF-004"],
    mascot: "high-five",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "PW-007",
    surface: "PW",
    name: "How It Works",
    route: "/how-it-works",
    actorScope: "Public",
    workflows: ["WF-007", "WF-024", "WF-025"],
    mascot: "suitcase-walk",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "PW-008",
    surface: "PW",
    name: "Help Centre & FAQs",
    route: "/help",
    actorScope: "Public",
    workflows: ["WF-039"],
    mascot: "thinking",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "PW-009",
    surface: "PW",
    name: "Contact Us & Inquiries",
    route: "/contact",
    actorScope: "Public",
    workflows: ["WF-039"],
    mascot: "phone",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "PW-010",
    surface: "PW",
    name: "Terms, Privacy & Legal",
    route: "/terms",
    actorScope: "Public",
    workflows: ["WF-001", "WF-027"],
    mascot: "salute",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "PW-011",
    surface: "PW",
    name: "Traveller Web Portal",
    route: "/portal/bookings",
    actorScope: "Traveller",
    workflows: ["WF-021", "WF-022", "WF-030", "WF-037"],
    mascot: "suitcase-walk",
    backendDependency: "HYBRID_PREVIEW"
  }
];

export const WEB_HOST_SCREENS: RegisteredScreenSpec[] = [
  {
    id: "HD-001",
    surface: "HD",
    name: "Host Overview Dashboard",
    route: "/host/dashboard",
    actorScope: "Host Owner / Staff",
    workflows: ["WF-021", "WF-024", "WF-033"],
    mascot: "salute",
    backendDependency: "HYBRID_PREVIEW"
  },
  {
    id: "HD-002",
    surface: "HD",
    name: "Location Management",
    route: "/host/locations",
    actorScope: "Host Owner",
    workflows: ["WF-010"],
    mascot: "map",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "HD-003",
    surface: "HD",
    name: "Location Profile Editor",
    route: "/host/locations/:id",
    actorScope: "Host Owner",
    workflows: ["WF-010"],
    mascot: "pointing",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "HD-004",
    surface: "HD",
    name: "Schedule & Calendar Editor",
    route: "/host/locations/:id/schedule",
    actorScope: "Host Owner",
    workflows: ["WF-011", "WF-012"],
    mascot: "sleeping",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "HD-005",
    surface: "HD",
    name: "Capacity Pools & Zones",
    route: "/host/locations/:id/capacity",
    actorScope: "Host Owner",
    workflows: ["WF-014", "WF-015"],
    mascot: "suitcase-hug",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "HD-006",
    surface: "HD",
    name: "Pricing Rules & Multipliers",
    route: "/host/locations/:id/pricing",
    actorScope: "Host Owner",
    workflows: ["WF-016"],
    mascot: "blank-tag",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "HD-007",
    surface: "HD",
    name: "Booking Management Hub",
    route: "/host/bookings",
    actorScope: "Host Owner / Staff",
    workflows: ["WF-021", "WF-024", "WF-025", "WF-026"],
    mascot: "suitcase-peek",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "HD-008",
    surface: "HD",
    name: "Booking Investigation Modal",
    route: "/host/bookings?inspect=:bookingId",
    actorScope: "Host Owner / Staff",
    workflows: ["WF-024", "WF-025", "WF-027", "WF-041"],
    mascot: "selfie",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "HD-009",
    surface: "HD",
    name: "Web Check-in/Out Operations",
    route: "/host/operations",
    actorScope: "Host Owner / Staff",
    workflows: ["WF-024", "WF-025"],
    mascot: "phone",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "HD-010",
    surface: "HD",
    name: "Financial Revenue & Ledger",
    route: "/host/finance",
    actorScope: "Host Owner",
    workflows: ["WF-033"],
    mascot: "king-coconut",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "HD-011",
    surface: "HD",
    name: "Payout Accounts & History",
    route: "/host/payouts",
    actorScope: "Host Owner",
    workflows: ["WF-034", "WF-035"],
    mascot: "key",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "HD-012",
    surface: "HD",
    name: "Review Management",
    route: "/host/reviews",
    actorScope: "Host Owner / Staff",
    workflows: ["WF-037"],
    mascot: "high-five",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "HD-013",
    surface: "HD",
    name: "Staff Management & RBAC",
    route: "/host/staff",
    actorScope: "Host Owner",
    workflows: ["WF-006"],
    mascot: "key",
    backendDependency: "HYBRID_PREVIEW"
  },
  {
    id: "HD-014",
    surface: "HD",
    name: "Business Profile & Legal",
    route: "/host/settings",
    actorScope: "Host Owner",
    workflows: ["WF-004"],
    mascot: "salute",
    backendDependency: "UI_SIMULATION"
  }
];

export const WEB_ADMIN_SCREENS: RegisteredScreenSpec[] = [
  {
    id: "AD-001",
    surface: "AD",
    name: "Platform Command Dashboard",
    route: "/admin",
    actorScope: "Superadmin",
    workflows: ["WF-005", "WF-031", "WF-034", "WF-041"],
    mascot: "salute",
    backendDependency: "HYBRID_PREVIEW"
  },
  {
    id: "AD-002",
    surface: "AD",
    name: "Host Verification Queue",
    route: "/admin/hosts/review",
    actorScope: "Superadmin",
    workflows: ["WF-005"],
    mascot: "selfie",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "AD-003",
    surface: "AD",
    name: "Host Directory & Management",
    route: "/admin/hosts",
    actorScope: "Superadmin / Support",
    workflows: ["WF-005", "WF-013"],
    mascot: "high-five",
    backendDependency: "HYBRID_PREVIEW"
  },
  {
    id: "AD-004",
    surface: "AD",
    name: "Storage Location Moderation",
    route: "/admin/locations",
    actorScope: "Superadmin",
    workflows: ["WF-010", "WF-013"],
    mascot: "map",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "AD-005",
    surface: "AD",
    name: "Global Bookings Ledger",
    route: "/admin/bookings",
    actorScope: "Superadmin / Support",
    workflows: ["WF-018", "WF-028", "WF-029"],
    mascot: "suitcase-hug",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "AD-006",
    surface: "AD",
    name: "Payment Transactions Log",
    route: "/admin/payments",
    actorScope: "Superadmin",
    workflows: ["WF-019", "WF-020"],
    mascot: "phone",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "AD-007",
    surface: "AD",
    name: "Refund Management Queue",
    route: "/admin/refunds",
    actorScope: "Superadmin",
    workflows: ["WF-030", "WF-031", "WF-032"],
    mascot: "sitting-suitcase",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "AD-008",
    surface: "AD",
    name: "Host Payout Batch Generation",
    route: "/admin/payouts/batches",
    actorScope: "Superadmin",
    workflows: ["WF-034"],
    mascot: "alarm-clock",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "AD-009",
    surface: "AD",
    name: "Manual Payout Disbursement",
    route: "/admin/payouts/disburse",
    actorScope: "Superadmin",
    workflows: ["WF-035"],
    mascot: "jump",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "AD-010",
    surface: "AD",
    name: "Double-Entry Financial Ledger",
    route: "/admin/finance/ledger",
    actorScope: "Superadmin",
    workflows: ["WF-036"],
    mascot: "blank-tag",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "AD-011",
    surface: "AD",
    name: "Support Ticket Triage Queue",
    route: "/admin/support",
    actorScope: "Support / Superadmin",
    workflows: ["WF-039", "WF-040"],
    mascot: "thinking",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "AD-012",
    surface: "AD",
    name: "Support Ticket Resolution View",
    route: "/admin/support/:id",
    actorScope: "Support / Superadmin",
    workflows: ["WF-040"],
    mascot: "phone",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "AD-013",
    surface: "AD",
    name: "Incident & Dispute Investigation",
    route: "/admin/incidents",
    actorScope: "Superadmin",
    workflows: ["WF-027", "WF-041", "WF-042"],
    mascot: "shrug",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "AD-014",
    surface: "AD",
    name: "Review Moderation Queue",
    route: "/admin/reviews",
    actorScope: "Superadmin",
    workflows: ["WF-038"],
    mascot: "high-five",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "AD-015",
    surface: "AD",
    name: "Promotion & Marketing Engine",
    route: "/admin/promotions",
    actorScope: "Superadmin",
    workflows: ["WF-043"],
    mascot: "blank-tag",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "AD-016",
    surface: "AD",
    name: "Platform System Configuration",
    route: "/admin/settings",
    actorScope: "Superadmin",
    workflows: ["WF-044"],
    mascot: "pointing",
    backendDependency: "UI_SIMULATION"
  },
  {
    id: "AD-017",
    surface: "AD",
    name: "Security & Compliance Audit Log",
    route: "/admin/audit",
    actorScope: "Superadmin",
    workflows: ["WF-005", "WF-031", "WF-035", "WF-044"],
    mascot: "key",
    backendDependency: "LIVE_PHASE_1B"
  },
  {
    id: "AD-018",
    surface: "AD",
    name: "Administrative Staff & RBAC",
    route: "/admin/staff",
    actorScope: "Superadmin",
    workflows: ["WF-006", "WF-044"],
    mascot: "key",
    backendDependency: "LIVE_PHASE_1B"
  }
];

export const ALL_WEB_SCREENS: RegisteredScreenSpec[] = [
  ...WEB_PUBLIC_SCREENS,
  ...WEB_HOST_SCREENS,
  ...WEB_ADMIN_SCREENS
];

// ============================================================================
// Domain Demo Data (Sri Lanka Initial Market + International Ready)
// ============================================================================

export interface StorageLocationItem {
  id: string;
  slug: string;
  name: string;
  city: string;
  district: string;
  landmark: string;
  distanceKm: number;
  rating: number | null;
  reviewCount: number;
  verifiedHost: string;
  openHours: string;
  is24Hours: boolean;
  hasCctv: boolean;
  hasClimateControl: boolean;
  hasInsurance: boolean;
  insuranceLimitLkr: number;
  photoEvidencePolicy: "OPTIONAL_BY_DEFAULT" | "CONFIGURED_MANDATORY";
  gracePeriodMinutes: number;
  lateFeePolicyLabel: string;
  hourlyRateLkr: {
    SMALL: number;
    MEDIUM: number;
    LARGE: number;
    OVERSIZED: number;
  };
  dailyCapLkr: {
    SMALL: number;
    MEDIUM: number;
    LARGE: number;
    OVERSIZED: number;
  };
  totalCapacity: number;
  availableCapacity: number;
  coordinates: { lat: number; lng: number };
  addressMasked: string;
  addressExact: string;
  zones: { id: string; code: string; name: string; capacity: number; occupied: number }[];
  description: string;
}

export const DEMO_LOCATIONS: StorageLocationItem[] = [
  {
    id: "loc-cmb-fort-01",
    slug: "colombo-fort-railway-hub",
    name: "Colombo Fort Station Heritage Vault",
    city: "Colombo",
    district: "Colombo 01",
    landmark: "120m from Colombo Fort Railway Main Entrance",
    distanceKm: 0.12,
    rating: 4.9,
    reviewCount: 214,
    verifiedHost: "Ceylon Transit Hospitality (Pvt) Ltd",
    openHours: "24 Hours (Daily)",
    is24Hours: true,
    hasCctv: true,
    hasClimateControl: true,
    hasInsurance: true,
    insuranceLimitLkr: 250000,
    photoEvidencePolicy: "CONFIGURED_MANDATORY",
    gracePeriodMinutes: 30,
    lateFeePolicyLabel: "Illustrative Location Policy: 30m grace period, then configurable hourly/daily late rate (e.g. 1.5x daily rate)",
    hourlyRateLkr: { SMALL: 150, MEDIUM: 250, LARGE: 350, OVERSIZED: 500 },
    dailyCapLkr: { SMALL: 900, MEDIUM: 1450, LARGE: 1950, OVERSIZED: 2800 },
    totalCapacity: 80,
    availableCapacity: 52,
    coordinates: { lat: 6.9344, lng: 79.8501 },
    addressMasked: "Olcott Mawatha, Near Fort Clock Tower, Colombo 01",
    addressExact: "No. 48B Olcott Mawatha, Ground Floor Vault, Colombo 01",
    zones: [
      { id: "z-1", code: "RACK-A", name: "Main Locked Steel Rack A", capacity: 40, occupied: 18 },
      { id: "z-2", code: "VAULT-B", name: "Climate-Controlled Back Vault", capacity: 30, occupied: 8 },
      { id: "z-3", code: "SURF-C", name: "Oversized Surfboard & Gear Bay", capacity: 10, occupied: 2 }
    ],
    description:
      "Dedicated 24/7 CCTV-monitored luggage vault steps from Colombo Fort Railway Station and Lotus Tower shuttle terminal. Ideal for intercity rail travellers and Pettah market explorers."
  },
  {
    id: "loc-ella-02",
    slug: "ella-station-tea-trail-lockers",
    name: "Ella Railway & Nine Arch Trail Hub",
    city: "Ella",
    district: "Badulla",
    landmark: "80m from Ella Railway Station Platform 1 Exit",
    distanceKm: 0.08,
    rating: 4.8,
    reviewCount: 168,
    verifiedHost: "Hill Country Boutique Stays",
    openHours: "05:30 – 22:30",
    is24Hours: false,
    hasCctv: true,
    hasClimateControl: false,
    hasInsurance: true,
    insuranceLimitLkr: 250000,
    photoEvidencePolicy: "OPTIONAL_BY_DEFAULT",
    gracePeriodMinutes: 45,
    lateFeePolicyLabel: "Illustrative Location Policy: 45m train-delay grace period, then standard hourly rate per bag",
    hourlyRateLkr: { SMALL: 140, MEDIUM: 220, LARGE: 320, OVERSIZED: 450 },
    dailyCapLkr: { SMALL: 850, MEDIUM: 1300, LARGE: 1800, OVERSIZED: 2500 },
    totalCapacity: 45,
    availableCapacity: 19,
    coordinates: { lat: 6.8756, lng: 81.0463 },
    addressMasked: "Station Road, Ella Town Centre",
    addressExact: "No. 14 Station Road, Opposite Railway Ticket Plaza, Ella",
    zones: [
      { id: "z-4", code: "TRAIL-A", name: "Hiker Daypack Shelving", capacity: 25, occupied: 16 },
      { id: "z-5", code: "TRUNK-B", name: "Hard-Shell Suitcase Room", capacity: 20, occupied: 10 }
    ],
    description:
      "Hike Little Adam's Peak and Nine Arch Bridge hands-free before catching the Kandy-Badulla scenic train. Tamper-evident security seals applied to every zipper."
  },
  {
    id: "loc-kandy-03",
    slug: "kandy-temple-quarter-concierge",
    name: "Kandy Lake & Temple Quarter Concierge",
    city: "Kandy",
    district: "Kandy Central",
    landmark: "200m from Sri Dalada Maligawa (Temple of the Tooth)",
    distanceKm: 0.2,
    rating: 4.9,
    reviewCount: 142,
    verifiedHost: "Kandy Royal Heritage Lounge",
    openHours: "06:00 – 21:30",
    is24Hours: false,
    hasCctv: true,
    hasClimateControl: true,
    hasInsurance: true,
    insuranceLimitLkr: 250000,
    photoEvidencePolicy: "CONFIGURED_MANDATORY",
    gracePeriodMinutes: 30,
    lateFeePolicyLabel: "Illustrative Location Policy: 30m grace period, then configurable daily extension tier",
    hourlyRateLkr: { SMALL: 150, MEDIUM: 240, LARGE: 340, OVERSIZED: 480 },
    dailyCapLkr: { SMALL: 880, MEDIUM: 1400, LARGE: 1900, OVERSIZED: 2600 },
    totalCapacity: 60,
    availableCapacity: 41,
    coordinates: { lat: 7.2936, lng: 80.6413 },
    addressMasked: "Dalada Veediya, Kandy Cultural Precinct",
    addressExact: "No. 22 Dalada Veediya, Queen's Arcade Suite 3, Kandy",
    zones: [
      { id: "z-6", code: "SANCTUARY-A", name: "Ground Floor Concierge Vault", capacity: 40, occupied: 14 },
      { id: "z-7", code: "VIP-B", name: "Electronics & Camera Locker Bay", capacity: 20, occupied: 5 }
    ],
    description:
      "Since large backpacks and suitcases are prohibited inside the Temple of the Sacred Tooth Relic security perimeter, store your bags safely with server-verified QR or backup PIN custody."
  },
  {
    id: "loc-galle-04",
    slug: "galle-fort-pedlar-street-vault",
    name: "Galle Fort Dutch Hospital Safe Keep",
    city: "Galle",
    district: "Galle Fort UNESCO Zone",
    landmark: "150m from Galle Fort Main Gate & Ramparts",
    distanceKm: 0.15,
    rating: 4.7,
    reviewCount: 97,
    verifiedHost: "Southern Coast Surf & Stay Co.",
    openHours: "07:00 – 23:00",
    is24Hours: false,
    hasCctv: true,
    hasClimateControl: true,
    hasInsurance: true,
    insuranceLimitLkr: 250000,
    photoEvidencePolicy: "OPTIONAL_BY_DEFAULT",
    gracePeriodMinutes: 30,
    lateFeePolicyLabel: "Illustrative Location Policy: 30m grace period, then configurable late collection surcharge (e.g. 1.5x daily rate)",
    hourlyRateLkr: { SMALL: 160, MEDIUM: 260, LARGE: 360, OVERSIZED: 520 },
    dailyCapLkr: { SMALL: 950, MEDIUM: 1500, LARGE: 2100, OVERSIZED: 2950 },
    totalCapacity: 50,
    availableCapacity: 33,
    coordinates: { lat: 6.0269, lng: 80.217 },
    addressMasked: "Hospital Street, Galle Fort",
    addressExact: "No. 9 Hospital Street, Old Courtyard Annex, Galle Fort",
    zones: [
      { id: "z-8", code: "FORT-A", name: "Dehumidified Heritage Room", capacity: 35, occupied: 12 },
      { id: "z-9", code: "BOARD-B", name: "Padded Surfboard & Dive Gear Rack", capacity: 15, occupied: 5 }
    ],
    description:
      "Stroll the cobbled streets of Galle Fort, lighthouse, and cafes without dragging wheeled bags or surfboards across historic ramparts."
  },
  {
    id: "loc-cmb-bia-05",
    slug: "katunayake-airport-express-lounge",
    name: "Bandaranaike Airport (CMB) Transit Storage",
    city: "Katunayake",
    district: "Gampaha",
    landmark: "450m from BIA Arrival Terminal Exit Gate",
    distanceKm: 0.45,
    rating: 4.9,
    reviewCount: 310,
    verifiedHost: "AeroLanka Ground Concierge",
    openHours: "24 Hours (Daily)",
    is24Hours: true,
    hasCctv: true,
    hasClimateControl: true,
    hasInsurance: true,
    insuranceLimitLkr: 250000,
    photoEvidencePolicy: "CONFIGURED_MANDATORY",
    gracePeriodMinutes: 60,
    lateFeePolicyLabel: "Illustrative Location Policy: 60m flight-arrival grace window, then standard hourly/daily rate",
    hourlyRateLkr: { SMALL: 180, MEDIUM: 290, LARGE: 400, OVERSIZED: 600 },
    dailyCapLkr: { SMALL: 1100, MEDIUM: 1750, LARGE: 2350, OVERSIZED: 3300 },
    totalCapacity: 120,
    availableCapacity: 84,
    coordinates: { lat: 7.1808, lng: 79.8841 },
    addressMasked: "Airport Approach Road, Katunayake",
    addressExact: "Building 4, AeroTransit Plaza, Canada Friendship Road, Katunayake",
    zones: [
      { id: "z-10", code: "AERO-A", name: "Short-Stay Layover Rack", capacity: 60, occupied: 22 },
      { id: "z-11", code: "AERO-B", name: "Multi-Week Island Tour Vault", capacity: 60, occupied: 14 }
    ],
    description:
      "Leave heavy winter coats, extra suitcases, or golf/surf bags right outside CMB Airport while you travel light across Sri Lanka."
  }
];

export type BookingStatusType =
  | "PENDING_PAYMENT"
  | "PENDING_HOST_APPROVAL"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "COMPLETED"
  | "OVERDUE"
  | "DISPUTED_OVERDUE"
  | "CANCELLED_REFUNDED";

export interface DemoBookingRecord {
  id: string;
  reference: string;
  travellerName: string;
  travellerEmail: string;
  travellerPhone: string;
  locationId: string;
  locationName: string;
  city: string;
  dropOffIso: string;
  pickUpIso: string;
  bags: { SMALL: number; MEDIUM: number; LARGE: number; OVERSIZED: number };
  totalBags: number;
  totalAmountLkr: number;
  platformCommissionLkr: number;
  hostNetPayoutLkr: number;
  status: BookingStatusType;
  pinCode: string;
  qrPayload: string;
  slaRemainingMinutes?: number;
  sealIds: string[];
  zoneCode: string;
  evidencePhotosCount: number;
  refundStage?: number;
}

export const DEMO_BOOKINGS: DemoBookingRecord[] = [
  {
    id: "bkg-1001",
    reference: "LS-2026-8841",
    travellerName: "Amaya Perera",
    travellerEmail: "amaya.perera@example.com",
    travellerPhone: "+94 77 412 8890",
    locationId: "loc-cmb-fort-01",
    locationName: "Colombo Fort Station Heritage Vault",
    city: "Colombo",
    dropOffIso: "2026-11-09T09:00:00+05:30",
    pickUpIso: "2026-11-09T18:00:00+05:30",
    bags: { SMALL: 1, MEDIUM: 2, LARGE: 0, OVERSIZED: 0 },
    totalBags: 3,
    totalAmountLkr: 3800,
    platformCommissionLkr: 570,
    hostNetPayoutLkr: 3230,
    status: "CHECKED_IN",
    pinCode: "482910",
    qrPayload: "LS-CUSTODY://LS-2026-8841/HMAC-9F8A72B",
    sealIds: ["SEAL-LK-90211", "SEAL-LK-90212", "SEAL-LK-90213"],
    zoneCode: "RACK-A",
    evidencePhotosCount: 3
  },
  {
    id: "bkg-1002",
    reference: "LS-2026-8842",
    travellerName: "Liam O'Connor",
    travellerEmail: "liam.oconnor@example.ie",
    travellerPhone: "+353 87 555 0192",
    locationId: "loc-ella-02",
    locationName: "Ella Railway & Nine Arch Trail Hub",
    city: "Ella",
    dropOffIso: "2026-11-10T08:30:00+05:30",
    pickUpIso: "2026-11-10T16:30:00+05:30",
    bags: { SMALL: 0, MEDIUM: 1, LARGE: 1, OVERSIZED: 0 },
    totalBags: 2,
    totalAmountLkr: 3100,
    platformCommissionLkr: 465,
    hostNetPayoutLkr: 2635,
    status: "CONFIRMED",
    pinCode: "739204",
    qrPayload: "LS-CUSTODY://LS-2026-8842/HMAC-3C1E44D",
    sealIds: [],
    zoneCode: "TRUNK-B",
    evidencePhotosCount: 0
  },
  {
    id: "bkg-1003",
    reference: "LS-2026-8843",
    travellerName: "Nadeesha Silva",
    travellerEmail: "nadeesha.s@example.lk",
    travellerPhone: "+94 71 908 3312",
    locationId: "loc-cmb-fort-01",
    locationName: "Colombo Fort Station Heritage Vault",
    city: "Colombo",
    dropOffIso: "2026-11-09T11:30:00+05:30",
    pickUpIso: "2026-11-09T19:30:00+05:30",
    bags: { SMALL: 0, MEDIUM: 2, LARGE: 0, OVERSIZED: 0 },
    totalBags: 2,
    totalAmountLkr: 2900,
    platformCommissionLkr: 435,
    hostNetPayoutLkr: 2465,
    status: "PENDING_HOST_APPROVAL",
    pinCode: "510847",
    qrPayload: "LS-CUSTODY://LS-2026-8843/HMAC-7D2B19F",
    slaRemainingMinutes: 11,
    sealIds: [],
    zoneCode: "RACK-A",
    evidencePhotosCount: 0
  },
  {
    id: "bkg-1004",
    reference: "LS-2026-8835",
    travellerName: "Henrik Lindqvist",
    travellerEmail: "henrik.l@example.se",
    travellerPhone: "+46 70 123 4567",
    locationId: "loc-galle-04",
    locationName: "Galle Fort Dutch Hospital Safe Keep",
    city: "Galle",
    dropOffIso: "2026-11-08T10:00:00+05:30",
    pickUpIso: "2026-11-08T20:00:00+05:30",
    bags: { SMALL: 0, MEDIUM: 1, LARGE: 0, OVERSIZED: 1 },
    totalBags: 2,
    totalAmountLkr: 4450,
    platformCommissionLkr: 668,
    hostNetPayoutLkr: 3782,
    status: "OVERDUE",
    pinCode: "661928",
    qrPayload: "LS-CUSTODY://LS-2026-8835/HMAC-6B4A88E",
    sealIds: ["SEAL-LK-88101", "SEAL-LK-88102"],
    zoneCode: "BOARD-B",
    evidencePhotosCount: 2
  },
  {
    id: "bkg-1005",
    reference: "LS-2026-8810",
    travellerName: "Kasun Jayasuriya",
    travellerEmail: "kasun.j@example.lk",
    travellerPhone: "+94 76 221 4409",
    locationId: "loc-kandy-03",
    locationName: "Kandy Lake & Temple Quarter Concierge",
    city: "Kandy",
    dropOffIso: "2026-11-05T08:00:00+05:30",
    pickUpIso: "2026-11-05T15:00:00+05:30",
    bags: { SMALL: 2, MEDIUM: 0, LARGE: 0, OVERSIZED: 0 },
    totalBags: 2,
    totalAmountLkr: 1760,
    platformCommissionLkr: 264,
    hostNetPayoutLkr: 1496,
    status: "COMPLETED",
    pinCode: "194022",
    qrPayload: "LS-CUSTODY://LS-2026-8810/HMAC-1A0C93B",
    sealIds: ["SEAL-LK-77401", "SEAL-LK-77402"],
    zoneCode: "SANCTUARY-A",
    evidencePhotosCount: 2
  },
  {
    id: "bkg-1006",
    reference: "LS-2026-8799",
    travellerName: "Sophie Laurent",
    travellerEmail: "sophie.laurent@example.fr",
    travellerPhone: "+33 6 12 34 56 78",
    locationId: "loc-cmb-bia-05",
    locationName: "Bandaranaike Airport (CMB) Transit Storage",
    city: "Katunayake",
    dropOffIso: "2026-11-12T06:00:00+05:30",
    pickUpIso: "2026-11-15T22:00:00+05:30",
    bags: { SMALL: 0, MEDIUM: 0, LARGE: 2, OVERSIZED: 0 },
    totalBags: 2,
    totalAmountLkr: 15980,
    platformCommissionLkr: 2397,
    hostNetPayoutLkr: 13583,
    status: "CANCELLED_REFUNDED",
    pinCode: "882319",
    qrPayload: "LS-CUSTODY://LS-2026-8799/HMAC-5E9D11C",
    sealIds: [],
    zoneCode: "AERO-B",
    evidencePhotosCount: 0,
    refundStage: 6
  }
];

export const REFUND_SEVEN_STAGES = [
  { stage: 1, code: "REQUESTED", label: "Cancellation & Refund Requested", timestamp: "2026-11-07 14:10 IST", completed: true },
  { stage: 2, code: "POLICY_EVALUATED", label: "Policy Window Evaluated (>2h Before Drop-Off = 100%)", timestamp: "2026-11-07 14:10 IST", completed: true },
  { stage: 3, code: "CAPACITY_RELEASED", label: "Capacity Pool Slots Released Atomically", timestamp: "2026-11-07 14:11 IST", completed: true },
  { stage: 4, code: "LEDGER_REVERSED", label: "Double-Entry Settlement Liability Reversed", timestamp: "2026-11-07 14:12 IST", completed: true },
  { stage: 5, code: "GATEWAY_SUBMITTED", label: "PayHere Refund API Dispatched", timestamp: "2026-11-07 14:15 IST", completed: true },
  { stage: 6, code: "BANK_PROCESSING", label: "Acquiring Bank Settlement in Progress", timestamp: "2026-11-08 09:00 IST", completed: true },
  { stage: 7, code: "SETTLED_TO_CARD", label: "Refund Credited to Traveller Card", timestamp: "Est. 2026-11-10", completed: false }
];

export function formatLkr(amountLkr: number): string {
  return `LKR ${amountLkr.toLocaleString("en-LK")}`;
}

