export type MascotKey =
  | "wave"
  | "suitcase-walk"
  | "suitcase-peek"
  | "blank-tag"
  | "pointing"
  | "thinking"
  | "sleeping"
  | "phone"
  | "jump"
  | "map"
  | "sun-hat"
  | "high-five"
  | "alarm-clock"
  | "key"
  | "suitcase-hug"
  | "selfie"
  | "king-coconut"
  | "salute"
  | "shrug"
  | "sitting-suitcase";

export interface MascotAssetMeta {
  id: string;
  key: MascotKey;
  filename: string;
  publicPath: string;
  webpPath?: string;
  title: string;
  alt: string;
  tone: string;
  primaryScreens: string[];
}



export const MASCOT_CATALOGUE: Record<MascotKey, MascotAssetMeta> = {
  wave: {
    id: "MASCOT-01",
    key: "wave",
    filename: "LS-mascot_01_wave.png",
    publicPath: "/assets/mascots/LS-mascot_01_wave.png",
    title: "Kiri Waving Hello",
    alt: "Kiri the Sri Lankan palm squirrel mascot waving warmly with an LS luggage satchel",
    tone: "Welcoming, friendly, approachable",
    primaryScreens: ["TM-001", "TM-002", "PW-001", "HM-001"]
  },
  "suitcase-walk": {
    id: "MASCOT-02",
    key: "suitcase-walk",
    filename: "LS-mascot_02_suitcase-walk.png",
    publicPath: "/assets/mascots/LS-mascot_02_suitcase-walk.png",
    title: "Kiri Walking with Suitcase",
    alt: "Kiri walking briskly while pulling a rolling travel suitcase",
    tone: "Active travel, momentum, convenience",
    primaryScreens: ["PW-007", "TM-011", "PW-011"]
  },
  "suitcase-peek": {
    id: "MASCOT-03",
    key: "suitcase-peek",
    filename: "LS-mascot_03_suitcase-peek.png",
    publicPath: "/assets/mascots/LS-mascot_03_suitcase-peek.png",
    title: "Kiri Peeking Behind Suitcase",
    alt: "Kiri peeking curiously from behind a standing suitcase",
    tone: "Curious, discreet, empty state prompt",
    primaryScreens: ["TM-035", "TM-036", "HD-007"]
  },
  "blank-tag": {
    id: "MASCOT-04",
    key: "blank-tag",
    filename: "LS-mascot_04_blank-tag.png",
    publicPath: "/assets/mascots/LS-mascot_04_blank-tag.png",
    title: "Kiri Holding Luggage Tag",
    alt: "Kiri holding up a luggage tag for bag categorization and pricing",
    tone: "Pricing transparency, tagging, promotions",
    primaryScreens: ["TM-018", "HM-014", "HD-006", "AD-015"]
  },
  pointing: {
    id: "MASCOT-05",
    key: "pointing",
    filename: "LS-mascot_05_pointing.png",
    publicPath: "/assets/mascots/LS-mascot_05_pointing.png",
    title: "Kiri Pointing Helpfully",
    alt: "Kiri pointing upward with a helpful smile to highlight key instructions",
    tone: "Helpful guidance, tips, permissions",
    primaryScreens: ["TM-003", "TM-004", "HM-009"]
  },
  thinking: {
    id: "MASCOT-06",
    key: "thinking",
    filename: "LS-mascot_06_thinking.png",
    publicPath: "/assets/mascots/LS-mascot_06_thinking.png",
    title: "Kiri Thinking Thoughtfully",
    alt: "Kiri with paw on chin thinking through a question or search filter",
    tone: "Analytical, FAQ inquiry, filter adjustment",
    primaryScreens: ["PW-008", "TM-014", "TM-039", "AD-011"]
  },
  sleeping: {
    id: "MASCOT-07",
    key: "sleeping",
    filename: "LS-mascot_07_sleeping.png",
    publicPath: "/assets/mascots/LS-mascot_07_sleeping.png",
    title: "Kiri Sleeping Peacefully",
    alt: "Kiri sleeping peacefully curled up with fluffy tail",
    tone: "All clear, quiet inbox, overnight rest",
    primaryScreens: ["TM-037", "HM-010", "HD-004"]
  },
  phone: {
    id: "MASCOT-08",
    key: "phone",
    filename: "LS-mascot_08_phone.png",
    publicPath: "/assets/mascots/LS-mascot_08_phone.png",
    title: "Kiri Holding Smartphone",
    alt: "Kiri holding a smartphone displaying verification and QR handover details",
    tone: "Digital verification, OTP, live contact",
    primaryScreens: ["TM-008", "PW-009", "TM-028", "HM-021"]
  },
  jump: {
    id: "MASCOT-09",
    key: "jump",
    filename: "LS-mascot_09_jump.png",
    publicPath: "/assets/mascots/LS-mascot_09_jump.png",
    title: "Kiri Jumping for Joy",
    alt: "Kiri jumping enthusiastically in celebration of a confirmed booking",
    tone: "Joyful confirmation, milestone achieved",
    primaryScreens: ["TM-024", "PW-005", "HM-025"]
  },
  map: {
    id: "MASCOT-10",
    key: "map",
    filename: "LS-mascot_10_map.png",
    publicPath: "/assets/mascots/LS-mascot_10_map.png",
    title: "Kiri Studying Travel Map",
    alt: "Kiri holding an unfolded travel map to locate nearby luggage storage hubs",
    tone: "Geospatial discovery, route finding",
    primaryScreens: ["TM-012", "PW-002", "TM-015"]
  },
  "sun-hat": {
    id: "MASCOT-11",
    key: "sun-hat",
    filename: "LS-mascot_11_sun-hat.png",
    publicPath: "/assets/mascots/LS-mascot_11_sun-hat.png",
    title: "Kiri in Tropical Sun Hat",
    alt: "Kiri wearing a woven straw sun hat ready for tropical Sri Lankan travel",
    tone: "Island holiday, destination exploration",
    primaryScreens: ["TM-013", "HM-011"]
  },
  "high-five": {
    id: "MASCOT-12",
    key: "high-five",
    filename: "LS-mascot_12_high-five.png",
    publicPath: "/assets/mascots/LS-mascot_12_high-five.png",
    title: "Kiri Giving a High-Five",
    alt: "Kiri raising a paw for an enthusiastic partner high-five",
    tone: "Partnership, mutual trust, review thanks",
    primaryScreens: ["PW-006", "TM-034", "HM-035", "HD-012"]
  },
  "alarm-clock": {
    id: "MASCOT-13",
    key: "alarm-clock",
    filename: "LS-mascot_13_alarm-clock.png",
    publicPath: "/assets/mascots/LS-mascot_13_alarm-clock.png",
    title: "Kiri Holding Alarm Clock",
    alt: "Kiri holding a ringing alarm clock for SLA countdowns and overdue alerts",
    tone: "Time-sensitive SLA, countdown, overdue alert",
    primaryScreens: ["HM-018", "HM-026", "TM-030"]
  },
  key: {
    id: "MASCOT-14",
    key: "key",
    filename: "LS-mascot_14_key.png",
    publicPath: "/assets/mascots/LS-mascot_14_key.png",
    title: "Kiri Holding Security Key",
    alt: "Kiri holding a security key representing encrypted authentication and RBAC",
    tone: "Authentication, security, RBAC protection",
    primaryScreens: ["TM-005", "TM-007", "TM-043", "HM-002", "AD-018"]
  },
  "suitcase-hug": {
    id: "MASCOT-15",
    key: "suitcase-hug",
    filename: "LS-mascot_15_suitcase-hug.png",
    publicPath: "/assets/mascots/LS-mascot_15_suitcase-hug.png",
    title: "Kiri Hugging Suitcase Safely",
    alt: "Kiri hugging a suitcase protectively to represent verified safe custody",
    tone: "Safe custody, insurance guarantee, care",
    primaryScreens: ["TM-027", "TM-029", "PW-003"]
  },
  selfie: {
    id: "MASCOT-16",
    key: "selfie",
    filename: "LS-mascot_16_selfie.png",
    publicPath: "/assets/mascots/LS-mascot_16_selfie.png",
    title: "Kiri Taking Evidence Photo",
    alt: "Kiri holding a camera to capture check-in custody evidence and KYC documents",
    tone: "Photo evidence, KYC document capture",
    primaryScreens: ["HM-004", "HM-022", "HM-023", "TM-042"]
  },
  "king-coconut": {
    id: "MASCOT-17",
    key: "king-coconut",
    filename: "LS-mascot_17_king-coconut.png",
    publicPath: "/assets/mascots/LS-mascot_17_king-coconut.png",
    title: "Kiri Sipping King Coconut",
    alt: "Kiri relaxing with a fresh Sri Lankan Thambili king coconut while bags are stored",
    tone: "Hands-free relaxation, island leisure",
    primaryScreens: ["PW-001", "TM-029", "HM-029"]
  },
  salute: {
    id: "MASCOT-18",
    key: "salute",
    filename: "LS-mascot_18_salute.png",
    publicPath: "/assets/mascots/LS-mascot_18_salute.png",
    title: "Kiri Giving a Duty Salute",
    alt: "Kiri giving a crisp salute for host operations and platform command",
    tone: "Operational readiness, compliance, duty",
    primaryScreens: ["HM-006", "HD-001", "AD-001", "AD-002"]
  },
  shrug: {
    id: "MASCOT-19",
    key: "shrug",
    filename: "LS-mascot_19_shrug.png",
    publicPath: "/assets/mascots/LS-mascot_19_shrug.png",
    title: "Kiri Shrugging Empathetically",
    alt: "Kiri shrugging empathetically for error states, cancellations, or empty searches",
    tone: "Apologetic error state, 404, cancellation",
    primaryScreens: ["TM-023", "TM-031", "HM-028"]
  },
  "sitting-suitcase": {
    id: "MASCOT-20",
    key: "sitting-suitcase",
    filename: "LS-mascot_20_sitting-suitcase.png",
    publicPath: "/assets/mascots/LS-mascot_20_sitting-suitcase.png",
    title: "Kiri Sitting on Suitcase Waiting",
    alt: "Kiri sitting patiently on top of a suitcase while awaiting approval or status updates",
    tone: "Waiting for approval, polling, queue standby",
    primaryScreens: ["TM-021", "TM-022", "HM-005", "TM-033"]
  }
};

export const ALL_MASCOT_KEYS = Object.keys(MASCOT_CATALOGUE) as MascotKey[];

export function getMascotMeta(key: MascotKey): MascotAssetMeta {
  const base = MASCOT_CATALOGUE[key];
  if (!base) {
    throw new Error(`Unknown mascot key: ${key}`);
  }
  const webpPath =
    base.webpPath ||
    base.publicPath.replace("/assets/mascots/", "/assets/mascots/webp/").replace(".png", ".webp");
  return {
    ...base,
    webpPath,
  };
}


