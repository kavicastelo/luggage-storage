import { MascotKey } from "../lib/mascots";

export interface MobileScreenSpec {
  id: string;
  surface: "TM" | "HM";
  category: string;
  name: string;
  route: string;
  actorScope: "Public / Traveller" | "Traveller" | "Host Owner" | "Host / Staff";
  workflows: string[];
  mascot: MascotKey;
  backendDependency: "LIVE_PHASE_1B" | "HYBRID_PREVIEW" | "UI_SIMULATION";
  summary: string;
}

export const RESERVED_MOBILE_SCREEN_IDS = [
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

export const TRAVELLER_MOBILE_SCREENS: MobileScreenSpec[] = [
  {
    id: "TM-001",
    surface: "TM",
    category: "Onboarding & Auth",
    name: "Splash Screen",
    route: "/(traveller)?screen=TM-001",
    actorScope: "Public / Traveller",
    workflows: ["WF-001"],
    mascot: "wave",
    backendDependency: "LIVE_PHASE_1B",
    summary: "Brand launch screen with SecureStore session restoration check."
  },
  {
    id: "TM-002",
    surface: "TM",
    category: "Onboarding & Auth",
    name: "Onboarding Welcome",
    route: "/(traveller)?screen=TM-002",
    actorScope: "Public / Traveller",
    workflows: ["WF-001"],
    mascot: "wave",
    backendDependency: "UI_SIMULATION",
    summary: "3-slide value proposition carousel introducing Kiri and verified Sri Lanka custody."
  },
  {
    id: "TM-003",
    surface: "TM",
    category: "Onboarding & Auth",
    name: "Permissions Request",
    route: "/(traveller)?screen=TM-003",
    actorScope: "Public / Traveller",
    workflows: ["WF-001", "WF-007"],
    mascot: "pointing",
    backendDependency: "UI_SIMULATION",
    summary: "Contextual prompt for GPS location discovery, camera QR scanning, and SLA push alerts."
  },
  {
    id: "TM-004",
    surface: "TM",
    category: "Onboarding & Auth",
    name: "Language & Currency Selector",
    route: "/(traveller)?screen=TM-004",
    actorScope: "Public / Traveller",
    workflows: ["WF-001"],
    mascot: "pointing",
    backendDependency: "UI_SIMULATION",
    summary: "Select interface language (English, Sinhala, Tamil) and display currency (LKR default)."
  },
  {
    id: "TM-005",
    surface: "TM",
    category: "Onboarding & Auth",
    name: "Login Screen",
    route: "/(auth)/login",
    actorScope: "Public / Traveller",
    workflows: ["WF-002"],
    mascot: "key",
    backendDependency: "LIVE_PHASE_1B",
    summary: "Email/password authentication with Expo SecureStore refresh token persistence."
  },
  {
    id: "TM-006",
    surface: "TM",
    category: "Onboarding & Auth",
    name: "Registration Screen",
    route: "/(auth)/register",
    actorScope: "Public / Traveller",
    workflows: ["WF-001"],
    mascot: "key",
    backendDependency: "LIVE_PHASE_1B",
    summary: "New Traveller account creation with password policy validation."
  },
  {
    id: "TM-007",
    surface: "TM",
    category: "Onboarding & Auth",
    name: "Forgot Password",
    route: "/(auth)/forgot-password",
    actorScope: "Public / Traveller",
    workflows: ["WF-003"],
    mascot: "key",
    backendDependency: "LIVE_PHASE_1B",
    summary: "Enumeration-resistant password reset token request and recovery."
  },
  {
    id: "TM-008",
    surface: "TM",
    category: "Onboarding & Auth",
    name: "Email / Phone OTP Verification",
    route: "/(traveller)?screen=TM-008",
    actorScope: "Public / Traveller",
    workflows: ["WF-001"],
    mascot: "phone",
    backendDependency: "LIVE_PHASE_1B",
    summary: "Self-service email verification token and OTP confirmation."
  },
  {
    id: "TM-011",
    surface: "TM",
    category: "Discovery & Search",
    name: "Home & Destination Search",
    route: "/(traveller)?screen=TM-011",
    actorScope: "Public / Traveller",
    workflows: ["WF-007"],
    mascot: "suitcase-walk",
    backendDependency: "UI_SIMULATION",
    summary: "Primary traveller home dashboard with Sri Lanka transit hub quick-select and active pass banner."
  },
  {
    id: "TM-012",
    surface: "TM",
    category: "Discovery & Search",
    name: "Geospatial Map Discovery",
    route: "/(traveller)/explore",
    actorScope: "Public / Traveller",
    workflows: ["WF-007"],
    mascot: "map",
    backendDependency: "UI_SIMULATION",
    summary: "Interactive MapLibre pin explorer with radius distance and live LKR rate chips."
  },
  {
    id: "TM-013",
    surface: "TM",
    category: "Discovery & Search",
    name: "Discovery List & Filters",
    route: "/(traveller)?screen=TM-013",
    actorScope: "Public / Traveller",
    workflows: ["WF-007", "WF-008"],
    mascot: "sun-hat",
    backendDependency: "UI_SIMULATION",
    summary: "Sortable storage hub list with capacity indicators and security badges."
  },
  {
    id: "TM-014",
    surface: "TM",
    category: "Discovery & Search",
    name: "Filter Modal",
    route: "/(traveller)?screen=TM-014",
    actorScope: "Public / Traveller",
    workflows: ["WF-008"],
    mascot: "thinking",
    backendDependency: "UI_SIMULATION",
    summary: "Filter sheet for 24/7 hours, CCTV, climate-control, surfboard capacity, and LKR cap."
  },
  {
    id: "TM-015",
    surface: "TM",
    category: "Discovery & Search",
    name: "Storage Location Details",
    route: "/(traveller)?screen=TM-015",
    actorScope: "Public / Traveller",
    workflows: ["WF-009"],
    mascot: "map",
    backendDependency: "UI_SIMULATION",
    summary: "Detailed venue profile with masked area address, zone breakdown, and LKR rate table."
  },
  {
    id: "TM-016",
    surface: "TM",
    category: "Discovery & Search",
    name: "Location Reviews & Ratings",
    route: "/(traveller)?screen=TM-016",
    actorScope: "Public / Traveller",
    workflows: ["WF-009", "WF-037"],
    mascot: "high-five",
    backendDependency: "UI_SIMULATION",
    summary: "Verified post-checkout traveller reviews and host partner replies."
  },
  {
    id: "TM-017",
    surface: "TM",
    category: "Booking & Checkout",
    name: "Booking Date & Time Picker",
    route: "/(traveller)?screen=TM-017",
    actorScope: "Traveller",
    workflows: ["WF-017"],
    mascot: "suitcase-walk",
    backendDependency: "UI_SIMULATION",
    summary: "Drop-off and pick-up date/time window selector validated against host operating hours."
  },
  {
    id: "TM-018",
    surface: "TM",
    category: "Booking & Checkout",
    name: "Bag Selection & Category Counter",
    route: "/(traveller)?screen=TM-018",
    actorScope: "Traveller",
    workflows: ["WF-017", "WF-018"],
    mascot: "blank-tag",
    backendDependency: "UI_SIMULATION",
    summary: "Interactive bag counter across Small, Medium, Large, and Oversized categories."
  },
  {
    id: "TM-019",
    surface: "TM",
    category: "Booking & Checkout",
    name: "Price Breakdown & Checkout",
    route: "/(traveller)?screen=TM-019",
    actorScope: "Traveller",
    workflows: ["WF-017", "WF-018"],
    mascot: "blank-tag",
    backendDependency: "UI_SIMULATION",
    summary: "Itemized LKR checkout summary with promo code redemption and protection coverage."
  },
  {
    id: "TM-020",
    surface: "TM",
    category: "Booking & Checkout",
    name: "Payment Gateway Webview",
    route: "/(traveller)?screen=TM-020",
    actorScope: "Traveller",
    workflows: ["WF-019"],
    mascot: "phone",
    backendDependency: "UI_SIMULATION",
    summary: "PayHere payment gateway checkout container preview."
  },
  {
    id: "TM-021",
    surface: "TM",
    category: "Booking & Checkout",
    name: "Payment Status Polling",
    route: "/(traveller)?screen=TM-021",
    actorScope: "Traveller",
    workflows: ["WF-020"],
    mascot: "sitting-suitcase",
    backendDependency: "UI_SIMULATION",
    summary: "Asynchronous webhook confirmation polling indicator."
  },
  {
    id: "TM-022",
    surface: "TM",
    category: "Booking & Checkout",
    name: "Host Approval Pending Screen",
    route: "/(traveller)?screen=TM-022",
    actorScope: "Traveller",
    workflows: ["WF-021", "WF-022"],
    mascot: "sitting-suitcase",
    backendDependency: "UI_SIMULATION",
    summary: "Live 15-minute Host SLA countdown timer for manual approval venues."
  },
  {
    id: "TM-023",
    surface: "TM",
    category: "Booking & Checkout",
    name: "Payment Failed Screen",
    route: "/(traveller)?screen=TM-023",
    actorScope: "Traveller",
    workflows: ["WF-020", "WF-023"],
    mascot: "shrug",
    backendDependency: "UI_SIMULATION",
    summary: "Recovery screen when card authorization fails or times out, allowing instant retry."
  },
  {
    id: "TM-024",
    surface: "TM",
    category: "Booking & Checkout",
    name: "Booking Confirmation Screen",
    route: "/(traveller)?screen=TM-024",
    actorScope: "Traveller",
    workflows: ["WF-020", "WF-021"],
    mascot: "jump",
    backendDependency: "UI_SIMULATION",
    summary: "Confirmed booking celebration unlocking exact street address, QR token, and 6-digit PIN."
  },
  {
    id: "TM-027",
    surface: "TM",
    category: "Active Custody & Refunds",
    name: "Active Booking Details",
    route: "/(traveller)?screen=TM-027",
    actorScope: "Traveller",
    workflows: ["WF-024", "WF-025"],
    mascot: "suitcase-hug",
    backendDependency: "UI_SIMULATION",
    summary: "Full booking command card with directions, host phone, and custody timeline."
  },
  {
    id: "TM-028",
    surface: "TM",
    category: "Active Custody & Refunds",
    name: "Check-in Handover Pass",
    route: "/(traveller)?screen=TM-028",
    actorScope: "Traveller",
    workflows: ["WF-024"],
    mascot: "phone",
    backendDependency: "UI_SIMULATION",
    summary: "High-brightness cryptographic QR code and 6-digit backup PIN for drop-off scanning."
  },
  {
    id: "TM-029",
    surface: "TM",
    category: "Active Custody & Refunds",
    name: "In-Storage Live Status",
    route: "/(traveller)?screen=TM-029",
    actorScope: "Traveller",
    workflows: ["WF-024", "WF-025"],
    mascot: "suitcase-hug",
    backendDependency: "UI_SIMULATION",
    summary: "Live custody monitor displaying seal numbers, storage zone rack, and check-in photos."
  },
  {
    id: "TM-030",
    surface: "TM",
    category: "Active Custody & Refunds",
    name: "Check-out Collection Pass",
    route: "/(traveller)?screen=TM-030",
    actorScope: "Traveller",
    workflows: ["WF-025"],
    mascot: "alarm-clock",
    backendDependency: "UI_SIMULATION",
    summary: "Collection QR/PIN verification pass to verify seal integrity and release bags."
  },
  {
    id: "TM-031",
    surface: "TM",
    category: "Active Custody & Refunds",
    name: "Booking Cancellation Flow",
    route: "/(traveller)?screen=TM-031",
    actorScope: "Traveller",
    workflows: ["WF-028"],
    mascot: "shrug",
    backendDependency: "UI_SIMULATION",
    summary: "Policy-transparent cancellation screen showing 100% (>24h) or 50% (<24h) refund calculation."
  },
  {
    id: "TM-032",
    surface: "TM",
    category: "Active Custody & Refunds",
    name: "Cancellation Result & Refund Status",
    route: "/(traveller)?screen=TM-032",
    actorScope: "Traveller",
    workflows: ["WF-028", "WF-030"],
    mascot: "shrug",
    backendDependency: "UI_SIMULATION",
    summary: "Confirmation of cancelled booking and immediate capacity pool release."
  },
  {
    id: "TM-033",
    surface: "TM",
    category: "Active Custody & Refunds",
    name: "Refund Detail Tracking",
    route: "/(traveller)?screen=TM-033",
    actorScope: "Traveller",
    workflows: ["WF-030", "WF-032"],
    mascot: "sitting-suitcase",
    backendDependency: "UI_SIMULATION",
    summary: "7-stage refund settlement tracker from cancellation request to card credit."
  },
  {
    id: "TM-034",
    surface: "TM",
    category: "Active Custody & Refunds",
    name: "Submit Review & Rating",
    route: "/(traveller)?screen=TM-034",
    actorScope: "Traveller",
    workflows: ["WF-037"],
    mascot: "high-five",
    backendDependency: "UI_SIMULATION",
    summary: "Post-checkout 1-5 star rating and experience review form."
  },
  {
    id: "TM-035",
    surface: "TM",
    category: "Active Custody & Refunds",
    name: "Booking History List",
    route: "/(traveller)?screen=TM-035",
    actorScope: "Traveller",
    workflows: ["WF-024", "WF-025", "WF-030"],
    mascot: "suitcase-peek",
    backendDependency: "UI_SIMULATION",
    summary: "Tabbed booking archive (Upcoming, Active Custody, Completed, Cancelled)."
  },
  {
    id: "TM-036",
    surface: "TM",
    category: "Profile, Support & Settings",
    name: "Saved Favourites",
    route: "/(traveller)?screen=TM-036",
    actorScope: "Traveller",
    workflows: ["WF-007"],
    mascot: "suitcase-peek",
    backendDependency: "UI_SIMULATION",
    summary: "Bookmarked storage locations across Colombo, Ella, Kandy, and Galle."
  },
  {
    id: "TM-037",
    surface: "TM",
    category: "Profile, Support & Settings",
    name: "Notification Centre",
    route: "/(traveller)?screen=TM-037",
    actorScope: "Traveller",
    workflows: ["WF-021", "WF-026"],
    mascot: "sleeping",
    backendDependency: "UI_SIMULATION",
    summary: "In-app inbox for SLA approvals, check-in seal receipts, and pick-up reminders."
  },
  {
    id: "TM-039",
    surface: "TM",
    category: "Profile, Support & Settings",
    name: "Help & Support Centre",
    route: "/(traveller)?screen=TM-039",
    actorScope: "Traveller",
    workflows: ["WF-039"],
    mascot: "thinking",
    backendDependency: "UI_SIMULATION",
    summary: "Self-service FAQ knowledge base and emergency custody escalation links."
  },
  {
    id: "TM-040",
    surface: "TM",
    category: "Profile, Support & Settings",
    name: "Create Support Ticket",
    route: "/(traveller)?screen=TM-040",
    actorScope: "Traveller",
    workflows: ["WF-039"],
    mascot: "thinking",
    backendDependency: "UI_SIMULATION",
    summary: "Structured support ticket submission linked to a specific booking reference."
  },
  {
    id: "TM-041",
    surface: "TM",
    category: "Profile, Support & Settings",
    name: "Ticket Conversation Thread",
    route: "/(traveller)?screen=TM-041",
    actorScope: "Traveller",
    workflows: ["WF-039", "WF-040"],
    mascot: "sitting-suitcase",
    backendDependency: "UI_SIMULATION",
    summary: "Asynchronous message thread with Platform Support Agents."
  },
  {
    id: "TM-042",
    surface: "TM",
    category: "Profile, Support & Settings",
    name: "Traveller Profile & Account",
    route: "/(account)/profile",
    actorScope: "Traveller",
    workflows: ["WF-002"],
    mascot: "selfie",
    backendDependency: "LIVE_PHASE_1B",
    summary: "Authenticated user identity profile, roles, and active device sessions."
  },
  {
    id: "TM-043",
    surface: "TM",
    category: "Profile, Support & Settings",
    name: "Security & Password Update",
    route: "/(account)/security",
    actorScope: "Traveller",
    workflows: ["WF-003"],
    mascot: "key",
    backendDependency: "LIVE_PHASE_1B",
    summary: "Authenticated password change and multi-device session revocation."
  },
  {
    id: "TM-044",
    surface: "TM",
    category: "Profile, Support & Settings",
    name: "App Settings",
    route: "/(traveller)?screen=TM-044",
    actorScope: "Traveller",
    workflows: ["WF-001"],
    mascot: "king-coconut",
    backendDependency: "UI_SIMULATION",
    summary: "Notification preferences, biometric lock toggle, offline cache, and legal links."
  }
];

export const HOST_MOBILE_SCREENS: MobileScreenSpec[] = [
  {
    id: "HM-001",
    surface: "HM",
    category: "Host Onboarding & Auth",
    name: "Host Splash & Welcome",
    route: "/(host)?screen=HM-001",
    actorScope: "Host / Staff",
    workflows: ["WF-004"],
    mascot: "wave",
    backendDependency: "UI_SIMULATION",
    summary: "Host Partner mobile portal entry with Owner vs Staff operational mode."
  },
  {
    id: "HM-002",
    surface: "HM",
    category: "Host Onboarding & Auth",
    name: "Host Registration & Login",
    route: "/(auth)/login",
    actorScope: "Host / Staff",
    workflows: ["WF-002", "WF-004"],
    mascot: "key",
    backendDependency: "LIVE_PHASE_1B",
    summary: "Unified identity sign-in verifying HOST_OWNER or HOST_STAFF role privileges."
  },
  {
    id: "HM-003",
    surface: "HM",
    category: "Host Onboarding & Auth",
    name: "Business Profile Setup",
    route: "/(host)?screen=HM-003",
    actorScope: "Host Owner",
    workflows: ["WF-004"],
    mascot: "pointing",
    backendDependency: "UI_SIMULATION",
    summary: "Host Owner legal entity registration, Sri Lanka BRN, and primary contact setup."
  },
  {
    id: "HM-004",
    surface: "HM",
    category: "Host Onboarding & Auth",
    name: "KYC Document Upload",
    route: "/(host)?screen=HM-004",
    actorScope: "Host Owner",
    workflows: ["WF-004"],
    mascot: "selfie",
    backendDependency: "UI_SIMULATION",
    summary: "Upload NIC/Passport, Business Registration Certificate, and storage vault photos."
  },
  {
    id: "HM-005",
    surface: "HM",
    category: "Host Onboarding & Auth",
    name: "Host Application Status",
    route: "/(host)?screen=HM-005",
    actorScope: "Host Owner",
    workflows: ["WF-004", "WF-005"],
    mascot: "sitting-suitcase",
    backendDependency: "UI_SIMULATION",
    summary: "Track Superadmin KYC verification progress and remediate flagged documents."
  },
  {
    id: "HM-006",
    surface: "HM",
    category: "Location & Schedule Config",
    name: "Host Operations Dashboard",
    route: "/(host)?screen=HM-006",
    actorScope: "Host / Staff",
    workflows: ["WF-021", "WF-024", "WF-025"],
    mascot: "salute",
    backendDependency: "HYBRID_PREVIEW",
    summary: "Real-time counter command hub: 15m SLA queue, check-in/out counts, and overdue alerts."
  },
  {
    id: "HM-007",
    surface: "HM",
    category: "Location & Schedule Config",
    name: "Today's Expected Schedule",
    route: "/(host)?screen=HM-007",
    actorScope: "Host / Staff",
    workflows: ["WF-024", "WF-025"],
    mascot: "alarm-clock",
    backendDependency: "UI_SIMULATION",
    summary: "Chronological timeline of expected drop-offs and pick-ups for today's shift."
  },
  {
    id: "HM-009",
    surface: "HM",
    category: "Location & Schedule Config",
    name: "Storage Location Profile",
    route: "/(host)?screen=HM-009",
    actorScope: "Host Owner",
    workflows: ["WF-010"],
    mascot: "pointing",
    backendDependency: "UI_SIMULATION",
    summary: "Mobile editor for location title, landmark directions, and security features."
  },
  {
    id: "HM-010",
    surface: "HM",
    category: "Location & Schedule Config",
    name: "Operating Hours Editor",
    route: "/(host)?screen=HM-010",
    actorScope: "Host Owner",
    workflows: ["WF-011"],
    mascot: "sleeping",
    backendDependency: "UI_SIMULATION",
    summary: "Configure weekly opening/closing times and 24/7 vault operation toggles."
  },
  {
    id: "HM-011",
    surface: "HM",
    category: "Location & Schedule Config",
    name: "Schedule Exception Calendar",
    route: "/(host)?screen=HM-011",
    actorScope: "Host Owner",
    workflows: ["WF-012"],
    mascot: "sun-hat",
    backendDependency: "UI_SIMULATION",
    summary: "Add Poya day closures or special holiday operating hours."
  },
  {
    id: "HM-013",
    surface: "HM",
    category: "Location & Schedule Config",
    name: "Capacity & Zones Config",
    route: "/(host)?screen=HM-013",
    actorScope: "Host Owner",
    workflows: ["WF-014", "WF-015"],
    mascot: "suitcase-hug",
    backendDependency: "UI_SIMULATION",
    summary: "Configure total slot capacity and physical storage rack/zone codes."
  },
  {
    id: "HM-014",
    surface: "HM",
    category: "Location & Schedule Config",
    name: "Pricing Rules Editor",
    route: "/(host)?screen=HM-014",
    actorScope: "Host Owner",
    workflows: ["WF-016"],
    mascot: "blank-tag",
    backendDependency: "UI_SIMULATION",
    summary: "Configure LKR hourly rates, daily caps, multi-day discounts, and configurable grace periods & late collection fee policies (OQ-015)."
  },
  {
    id: "HM-018",
    surface: "HM",
    category: "Custody & Handover Operations",
    name: "Booking Requests Queue",
    route: "/(host)?screen=HM-018",
    actorScope: "Host / Staff",
    workflows: ["WF-021", "WF-022"],
    mascot: "alarm-clock",
    backendDependency: "UI_SIMULATION",
    summary: "Incoming booking requests with live 15-minute SLA approval countdown."
  },
  {
    id: "HM-019",
    surface: "HM",
    category: "Custody & Handover Operations",
    name: "Request Review & Decision",
    route: "/(host)?screen=HM-019",
    actorScope: "Host / Staff",
    workflows: ["WF-021"],
    mascot: "thinking",
    backendDependency: "UI_SIMULATION",
    summary: "Approve or decline a pending booking request with capacity verification."
  },
  {
    id: "HM-020",
    surface: "HM",
    category: "Custody & Handover Operations",
    name: "Active Bookings List",
    route: "/(host)?screen=HM-020",
    actorScope: "Host / Staff",
    workflows: ["WF-024", "WF-025"],
    mascot: "suitcase-peek",
    backendDependency: "UI_SIMULATION",
    summary: "Filterable roster of Checked-In, Confirmed Upcoming, and Overdue bookings."
  },
  {
    id: "HM-021",
    surface: "HM",
    category: "Custody & Handover Operations",
    name: "Check-in Scanner & PIN Entry",
    route: "/(host)/scanner",
    actorScope: "Host / Staff",
    workflows: ["WF-024"],
    mascot: "phone",
    backendDependency: "UI_SIMULATION",
    summary: "Server-verified QR camera scanner with rate-limited, audited 6-digit PIN fallback when QR scanning is unavailable (OQ-014)."
  },
  {
    id: "HM-022",
    surface: "HM",
    category: "Custody & Handover Operations",
    name: "Bag Inspection & Tagging",
    route: "/(host)?screen=HM-022",
    actorScope: "Host / Staff",
    workflows: ["WF-024"],
    mascot: "selfie",
    backendDependency: "UI_SIMULATION",
    summary: "Mandatory physical bag count & category reconciliation, storage zone rack assignment, and serialized seal IDs (OQ-014)."
  },
  {
    id: "HM-023",
    surface: "HM",
    category: "Custody & Handover Operations",
    name: "Check-in Evidence Camera",
    route: "/(host)?screen=HM-023",
    actorScope: "Host / Staff",
    workflows: ["WF-024"],
    mascot: "selfie",
    backendDependency: "UI_SIMULATION",
    summary: "Capture timestamped condition photos of bags and seals (optional by default; configurable as mandatory per location under OQ-014)."
  },
  {
    id: "HM-024",
    surface: "HM",
    category: "Custody & Handover Operations",
    name: "Check-out Verification Scanner",
    route: "/(host)?screen=HM-024",
    actorScope: "Host / Staff",
    workflows: ["WF-025"],
    mascot: "phone",
    backendDependency: "UI_SIMULATION",
    summary: "Scan traveller collection QR pass (or use rate-limited, audited 6-digit PIN fallback) and reconcile returned bag count (OQ-014)."
  },
  {
    id: "HM-025",
    surface: "HM",
    category: "Custody & Handover Operations",
    name: "Handover Release Confirmation",
    route: "/(host)?screen=HM-025",
    actorScope: "Host / Staff",
    workflows: ["WF-025"],
    mascot: "jump",
    backendDependency: "UI_SIMULATION",
    summary: "Record collection timestamp and responsible staff ID, release custody, and free capacity pool slots (OQ-014)."
  },
  {
    id: "HM-026",
    surface: "HM",
    category: "Overdue & Mandatory Release",
    name: "Overdue Bags Alert View",
    route: "/(host)?screen=HM-026",
    actorScope: "Host / Staff",
    workflows: ["WF-026"],
    mascot: "alarm-clock",
    backendDependency: "UI_SIMULATION",
    summary: "Monitor bags past the location's configurable grace period (e.g. illustrative 30m demo window) and log auditable overdue alerts (OQ-015)."
  },
  {
    id: "HM-027",
    surface: "HM",
    category: "Overdue & Mandatory Release",
    name: "Request Overdue Payment",
    route: "/(host)?screen=HM-027",
    actorScope: "Host / Staff",
    workflows: ["WF-026", "WF-027"],
    mascot: "alarm-clock",
    backendDependency: "UI_SIMULATION",
    summary: "Calculate disclosed, configurable late collection fee (e.g. illustrative 1.5x daily rate) and send in-app payment request—no silent charges (OQ-015)."
  },
  {
    id: "HM-028",
    surface: "HM",
    category: "Overdue & Mandatory Release",
    name: "Disputed Release Handover",
    route: "/(host)?screen=HM-028",
    actorScope: "Host / Staff",
    workflows: ["WF-027"],
    mascot: "shrug",
    backendDependency: "UI_SIMULATION",
    summary: "OQ-015 & Invariant BR-035 Decoupled Custody: release bags immediately upon QR/PIN check without possessory lien and escalate unpaid/disputed fee separately."
  },
  {
    id: "HM-029",
    surface: "HM",
    category: "Finance, Staff & Settings",
    name: "Host Earnings & Balance",
    route: "/(host)?screen=HM-029",
    actorScope: "Host Owner",
    workflows: ["WF-033"],
    mascot: "king-coconut",
    backendDependency: "UI_SIMULATION",
    summary: "Host Owner financial ledger displaying 85% net revenue and pending escrow."
  },
  {
    id: "HM-030",
    surface: "HM",
    category: "Finance, Staff & Settings",
    name: "Payout Bank Account Details",
    route: "/(host)?screen=HM-030",
    actorScope: "Host Owner",
    workflows: ["WF-034"],
    mascot: "key",
    backendDependency: "UI_SIMULATION",
    summary: "Configure Sri Lankan bank account (CEFT/SLIPS) for weekly LKR payouts."
  },
  {
    id: "HM-031",
    surface: "HM",
    category: "Finance, Staff & Settings",
    name: "Payout History & Receipts",
    route: "/(host)?screen=HM-031",
    actorScope: "Host Owner",
    workflows: ["WF-034", "WF-035"],
    mascot: "king-coconut",
    backendDependency: "UI_SIMULATION",
    summary: "Historical payout batch settlements and downloadable remittance advices."
  },
  {
    id: "HM-033",
    surface: "HM",
    category: "Finance, Staff & Settings",
    name: "Staff Management List",
    route: "/(host)?screen=HM-033",
    actorScope: "Host Owner",
    workflows: ["WF-006"],
    mascot: "high-five",
    backendDependency: "HYBRID_PREVIEW",
    summary: "Manage counter staff accounts assigned to HOST_STAFF operational role."
  },
  {
    id: "HM-034",
    surface: "HM",
    category: "Finance, Staff & Settings",
    name: "Invite Staff Member",
    route: "/(host)?screen=HM-034",
    actorScope: "Host Owner",
    workflows: ["WF-006"],
    mascot: "high-five",
    backendDependency: "UI_SIMULATION",
    summary: "Invite new counter staff scoped to specific storage locations."
  },
  {
    id: "HM-035",
    surface: "HM",
    category: "Finance, Staff & Settings",
    name: "Host Customer Reviews",
    route: "/(host)?screen=HM-035",
    actorScope: "Host / Staff",
    workflows: ["WF-037"],
    mascot: "high-five",
    backendDependency: "UI_SIMULATION",
    summary: "View verified traveller ratings and post official partner responses."
  },
  {
    id: "HM-036",
    surface: "HM",
    category: "Finance, Staff & Settings",
    name: "Incident & Dispute Report",
    route: "/(host)?screen=HM-036",
    actorScope: "Host / Staff",
    workflows: ["WF-041"],
    mascot: "salute",
    backendDependency: "UI_SIMULATION",
    summary: "Log damaged luggage, prohibited item discovery, or seal discrepancy with photo proof."
  },
  {
    id: "HM-037",
    surface: "HM",
    category: "Finance, Staff & Settings",
    name: "Host Business Settings",
    route: "/(host)?screen=HM-037",
    actorScope: "Host Owner",
    workflows: ["WF-004", "WF-010"],
    mascot: "salute",
    backendDependency: "UI_SIMULATION",
    summary: "Corporate tax settings, auto-approval toggles, and emergency contact configuration."
  }
];

export const ALL_MOBILE_SCREENS: MobileScreenSpec[] = [
  ...TRAVELLER_MOBILE_SCREENS,
  ...HOST_MOBILE_SCREENS
];

export interface StorageLocationItem {
  id: string;
  slug: string;
  name: string;
  city: string;
  district: string;
  landmark: string;
  distanceKm: number;
  rating: number;
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
    lateFeePolicyLabel: "Illustrative Location Policy: 60m flight-delay grace period, then standard hourly rate per bag",
    hourlyRateLkr: { SMALL: 175, MEDIUM: 275, LARGE: 380, OVERSIZED: 550 },
    dailyCapLkr: { SMALL: 1050, MEDIUM: 1650, LARGE: 2250, OVERSIZED: 3200 },
    totalCapacity: 120,
    availableCapacity: 84,
    coordinates: { lat: 7.1808, lng: 79.8841 },
    addressMasked: "Airport Access Highway, Katunayake",
    addressExact: "Airside Gateway Building, 2nd Floor, Katunayake",
    zones: [
      { id: "z-10", code: "AIR-A", name: "Oversized Aviation Baggage Zone", capacity: 60, occupied: 22 },
      { id: "z-11", code: "AIR-B", name: "Express Layover Lockers", capacity: 60, occupied: 14 }
    ],
    description:
      "Arriving early or facing a late night departure from Colombo BIA? Drop luggage safely 5 minutes from check-in desks and explore Negombo beaches hands-free."
  },
  {
    id: "loc-mirissa-06",
    slug: "mirissa-harbour-beach-lockers",
    name: "Mirissa Harbour & Whale Watch Storage",
    city: "Mirissa",
    district: "Matara",
    landmark: "50m from Mirissa Fishery Harbour Pier",
    distanceKm: 0.05,
    rating: 4.8,
    reviewCount: 88,
    verifiedHost: "Blue Horizon Expeditions",
    openHours: "05:00 – 21:00",
    is24Hours: false,
    hasCctv: true,
    hasClimateControl: false,
    hasInsurance: true,
    insuranceLimitLkr: 250000,
    photoEvidencePolicy: "OPTIONAL_BY_DEFAULT",
    gracePeriodMinutes: 30,
    lateFeePolicyLabel: "Illustrative Location Policy: 30m grace period, then standard hourly rate per bag",
    hourlyRateLkr: { SMALL: 130, MEDIUM: 210, LARGE: 300, OVERSIZED: 420 },
    dailyCapLkr: { SMALL: 800, MEDIUM: 1250, LARGE: 1750, OVERSIZED: 2400 },
    totalCapacity: 40,
    availableCapacity: 26,
    coordinates: { lat: 5.9482, lng: 80.4578 },
    addressMasked: "Harbour Road, Mirissa",
    addressExact: "Pier Side Locker Unit 4, Mirissa Fisheries Complex, Mirissa",
    zones: [
      { id: "z-12", code: "BEACH-A", name: "Waterproof Locker Cubicles", capacity: 25, occupied: 9 },
      { id: "z-13", code: "BOARD-B", name: "Surfboard & Snorkel Locker", capacity: 15, occupied: 5 }
    ],
    description:
      "Embark on 6:00 AM whale watching tours or surf Coconut Tree Hill without keeping bags in your tuk-tuk or wet beach cabana."
  }
];

export interface TravellerBookingItem {
  id: string;
  reference: string;
  locationId: string;
  locationName: string;
  city: string;
  landmark: string;
  status: "IN_STORAGE" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  dropOffTime: string;
  pickUpTime: string;
  bags: { SMALL: number; MEDIUM: number; LARGE: number; OVERSIZED: number };
  totalBags: number;
  totalLkr: number;
  qrPayload: string;
  pinFallback: string;
  seals: string[];
  zoneCode: string;
  photoLogged: boolean;
  hostPhone: string;
  exactAddress: string;
  refundStage?: number;
  refundAmountLkr?: number;
}

export const DEMO_BOOKINGS: TravellerBookingItem[] = [
  {
    id: "bk-8841",
    reference: "#LS-2026-8841",
    locationId: "loc-cmb-fort-01",
    locationName: "Colombo Fort Station Heritage Vault",
    city: "Colombo",
    landmark: "120m from Colombo Fort Railway Main Entrance",
    status: "IN_STORAGE",
    dropOffTime: "Today • 09:30 AM",
    pickUpTime: "Today • 18:30 PM",
    bags: { SMALL: 0, MEDIUM: 1, LARGE: 1, OVERSIZED: 0 },
    totalBags: 2,
    totalLkr: 3400,
    qrPayload: "LS-CUSTODY://LS-2026-8841/HMAC-9F8A72B",
    pinFallback: "482 910",
    seals: ["SEAL-LK-90211", "SEAL-LK-90212"],
    zoneCode: "RACK-A",
    photoLogged: true,
    hostPhone: "+94 11 234 5678",
    exactAddress: "No. 48B Olcott Mawatha, Ground Floor Vault, Colombo 01"
  },
  {
    id: "bk-7712",
    reference: "#LS-2026-7712",
    locationId: "loc-ella-02",
    locationName: "Ella Railway & Nine Arch Trail Hub",
    city: "Ella",
    landmark: "80m from Ella Railway Station Platform 1 Exit",
    status: "CONFIRMED",
    dropOffTime: "Tomorrow • 08:30 AM",
    pickUpTime: "Tomorrow • 17:00 PM",
    bags: { SMALL: 2, MEDIUM: 0, LARGE: 0, OVERSIZED: 0 },
    totalBags: 2,
    totalLkr: 1700,
    qrPayload: "LS-CUSTODY://LS-2026-7712/HMAC-4D2A91E",
    pinFallback: "194 820",
    seals: ["SEAL-LK-88301", "SEAL-LK-88302"],
    zoneCode: "TRAIL-A",
    photoLogged: false,
    hostPhone: "+94 57 222 8400",
    exactAddress: "No. 14 Station Road, Opposite Railway Ticket Plaza, Ella"
  },
  {
    id: "bk-6540",
    reference: "#LS-2026-6540",
    locationId: "loc-kandy-03",
    locationName: "Kandy Lake & Temple Quarter Concierge",
    city: "Kandy",
    landmark: "200m from Temple of the Sacred Tooth Relic",
    status: "COMPLETED",
    dropOffTime: "04 Nov • 10:00 AM",
    pickUpTime: "04 Nov • 16:30 PM",
    bags: { SMALL: 0, MEDIUM: 1, LARGE: 1, OVERSIZED: 0 },
    totalBags: 2,
    totalLkr: 3300,
    qrPayload: "LS-CUSTODY://LS-2026-6540/HMAC-7F1B34C",
    pinFallback: "671 204",
    seals: ["SEAL-LK-76120", "SEAL-LK-76121"],
    zoneCode: "SANCTUARY-A",
    photoLogged: true,
    hostPhone: "+94 81 223 4567",
    exactAddress: "No. 22 Dalada Veediya, Queen's Arcade Suite 3, Kandy"
  },
  {
    id: "bk-5120",
    reference: "#LS-2026-5120",
    locationId: "loc-galle-04",
    locationName: "Galle Fort Dutch Hospital Safe Keep",
    city: "Galle",
    landmark: "150m from Galle Fort Main Gate",
    status: "CANCELLED",
    dropOffTime: "01 Nov • 11:00 AM",
    pickUpTime: "01 Nov • 18:00 PM",
    bags: { SMALL: 1, MEDIUM: 1, LARGE: 0, OVERSIZED: 0 },
    totalBags: 2,
    totalLkr: 2450,
    qrPayload: "LS-CUSTODY://LS-2026-5120/CANCELLED",
    pinFallback: "000 000",
    seals: [],
    zoneCode: "FORT-A",
    photoLogged: false,
    hostPhone: "+94 91 224 8900",
    exactAddress: "No. 9 Hospital Street, Old Courtyard Annex, Galle Fort",
    refundStage: 7,
    refundAmountLkr: 2450
  }
];



