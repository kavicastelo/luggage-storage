import type { ImageSourcePropType } from "react-native";

import mascot01Wave from "../../assets/mascots/LS-mascot_01_wave.png";
import mascot02SuitcaseWalk from "../../assets/mascots/LS-mascot_02_suitcase-walk.png";
import mascot03SuitcasePeek from "../../assets/mascots/LS-mascot_03_suitcase-peek.png";
import mascot04BlankTag from "../../assets/mascots/LS-mascot_04_blank-tag.png";
import mascot05Pointing from "../../assets/mascots/LS-mascot_05_pointing.png";
import mascot06Thinking from "../../assets/mascots/LS-mascot_06_thinking.png";
import mascot07Sleeping from "../../assets/mascots/LS-mascot_07_sleeping.png";
import mascot08Phone from "../../assets/mascots/LS-mascot_08_phone.png";
import mascot09Jump from "../../assets/mascots/LS-mascot_09_jump.png";
import mascot10Map from "../../assets/mascots/LS-mascot_10_map.png";
import mascot11SunHat from "../../assets/mascots/LS-mascot_11_sun-hat.png";
import mascot12HighFive from "../../assets/mascots/LS-mascot_12_high-five.png";
import mascot13AlarmClock from "../../assets/mascots/LS-mascot_13_alarm-clock.png";
import mascot14Key from "../../assets/mascots/LS-mascot_14_key.png";
import mascot15SuitcaseHug from "../../assets/mascots/LS-mascot_15_suitcase-hug.png";
import mascot16Selfie from "../../assets/mascots/LS-mascot_16_selfie.png";
import mascot17KingCoconut from "../../assets/mascots/LS-mascot_17_king-coconut.png";
import mascot18Salute from "../../assets/mascots/LS-mascot_18_salute.png";
import mascot19Shrug from "../../assets/mascots/LS-mascot_19_shrug.png";
import mascot20SittingSuitcase from "../../assets/mascots/LS-mascot_20_sitting-suitcase.png";

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

export interface MobileMascotAssetMeta {
  id: string;
  key: MascotKey;
  filename: string;
  source: ImageSourcePropType;
  title: string;
  alt: string;
  tone: string;
  primaryScreens: string[];
}

export const MOBILE_MASCOT_CATALOGUE: Record<MascotKey, MobileMascotAssetMeta> = {
  wave: {
    id: "MASCOT-01",
    key: "wave",
    filename: "LS-mascot_01_wave.png",
    source: mascot01Wave,
    title: "Kiri Waving Hello",
    alt: "Kiri the Sri Lankan palm squirrel mascot waving warmly with an LS luggage satchel",
    tone: "Welcoming, friendly, approachable",
    primaryScreens: ["TM-001", "TM-002", "HM-001"]
  },
  "suitcase-walk": {
    id: "MASCOT-02",
    key: "suitcase-walk",
    filename: "LS-mascot_02_suitcase-walk.png",
    source: mascot02SuitcaseWalk,
    title: "Kiri Walking with Suitcase",
    alt: "Kiri walking briskly while pulling a rolling travel suitcase",
    tone: "Active travel, momentum, convenience",
    primaryScreens: ["TM-011", "TM-017"]
  },
  "suitcase-peek": {
    id: "MASCOT-03",
    key: "suitcase-peek",
    filename: "LS-mascot_03_suitcase-peek.png",
    source: mascot03SuitcasePeek,
    title: "Kiri Peeking Behind Suitcase",
    alt: "Kiri peeking curiously from behind a standing suitcase",
    tone: "Curious, discreet, empty state prompt",
    primaryScreens: ["TM-035", "TM-036", "HM-020"]
  },
  "blank-tag": {
    id: "MASCOT-04",
    key: "blank-tag",
    filename: "LS-mascot_04_blank-tag.png",
    source: mascot04BlankTag,
    title: "Kiri Holding Luggage Tag",
    alt: "Kiri holding up a luggage tag for bag categorization and pricing",
    tone: "Pricing transparency, tagging, promotions",
    primaryScreens: ["TM-018", "TM-019", "HM-014"]
  },
  pointing: {
    id: "MASCOT-05",
    key: "pointing",
    filename: "LS-mascot_05_pointing.png",
    source: mascot05Pointing,
    title: "Kiri Pointing Helpfully",
    alt: "Kiri pointing upward with a helpful smile to highlight key instructions",
    tone: "Helpful guidance, tips, permissions",
    primaryScreens: ["TM-003", "TM-004", "HM-003", "HM-009"]
  },
  thinking: {
    id: "MASCOT-06",
    key: "thinking",
    filename: "LS-mascot_06_thinking.png",
    source: mascot06Thinking,
    title: "Kiri Thinking Thoughtfully",
    alt: "Kiri with paw on chin thinking through a question or search filter",
    tone: "Analytical, FAQ inquiry, filter adjustment",
    primaryScreens: ["TM-014", "TM-039", "TM-040", "HM-019"]
  },
  sleeping: {
    id: "MASCOT-07",
    key: "sleeping",
    filename: "LS-mascot_07_sleeping.png",
    source: mascot07Sleeping,
    title: "Kiri Sleeping Peacefully",
    alt: "Kiri sleeping peacefully curled up with fluffy tail",
    tone: "All clear, quiet inbox, overnight rest",
    primaryScreens: ["TM-037", "HM-010"]
  },
  phone: {
    id: "MASCOT-08",
    key: "phone",
    filename: "LS-mascot_08_phone.png",
    source: mascot08Phone,
    title: "Kiri Holding Smartphone",
    alt: "Kiri holding a smartphone displaying verification and QR handover details",
    tone: "Digital verification, OTP, live contact",
    primaryScreens: ["TM-008", "TM-020", "TM-028", "HM-021", "HM-024"]
  },
  jump: {
    id: "MASCOT-09",
    key: "jump",
    filename: "LS-mascot_09_jump.png",
    source: mascot09Jump,
    title: "Kiri Jumping for Joy",
    alt: "Kiri jumping enthusiastically in celebration of a confirmed booking",
    tone: "Joyful confirmation, milestone achieved",
    primaryScreens: ["TM-024", "HM-025"]
  },
  map: {
    id: "MASCOT-10",
    key: "map",
    filename: "LS-mascot_10_map.png",
    source: mascot10Map,
    title: "Kiri Studying Travel Map",
    alt: "Kiri holding an unfolded travel map to locate nearby luggage storage hubs",
    tone: "Geospatial discovery, route finding",
    primaryScreens: ["TM-012", "TM-015"]
  },
  "sun-hat": {
    id: "MASCOT-11",
    key: "sun-hat",
    filename: "LS-mascot_11_sun-hat.png",
    source: mascot11SunHat,
    title: "Kiri in Tropical Sun Hat",
    alt: "Kiri wearing a woven straw sun hat ready for tropical Sri Lankan travel",
    tone: "Island holiday, destination exploration",
    primaryScreens: ["TM-013", "HM-011"]
  },
  "high-five": {
    id: "MASCOT-12",
    key: "high-five",
    filename: "LS-mascot_12_high-five.png",
    source: mascot12HighFive,
    title: "Kiri Giving a High-Five",
    alt: "Kiri raising a paw for an enthusiastic partner high-five",
    tone: "Partnership, mutual trust, review thanks",
    primaryScreens: ["TM-016", "TM-034", "HM-033", "HM-034", "HM-035"]
  },
  "alarm-clock": {
    id: "MASCOT-13",
    key: "alarm-clock",
    filename: "LS-mascot_13_alarm-clock.png",
    source: mascot13AlarmClock,
    title: "Kiri Holding Alarm Clock",
    alt: "Kiri holding a ringing alarm clock for SLA countdowns and overdue alerts",
    tone: "Time-sensitive SLA, countdown, overdue alert",
    primaryScreens: ["TM-030", "HM-007", "HM-018", "HM-026", "HM-027"]
  },
  key: {
    id: "MASCOT-14",
    key: "key",
    filename: "LS-mascot_14_key.png",
    source: mascot14Key,
    title: "Kiri Holding Security Key",
    alt: "Kiri holding a security key representing encrypted authentication and RBAC",
    tone: "Authentication, security, RBAC protection",
    primaryScreens: ["TM-005", "TM-006", "TM-007", "TM-043", "HM-002", "HM-030"]
  },
  "suitcase-hug": {
    id: "MASCOT-15",
    key: "suitcase-hug",
    filename: "LS-mascot_15_suitcase-hug.png",
    source: mascot15SuitcaseHug,
    title: "Kiri Hugging Suitcase Safely",
    alt: "Kiri hugging a suitcase protectively to represent verified safe custody",
    tone: "Safe custody, insurance guarantee, care",
    primaryScreens: ["TM-027", "TM-029", "HM-013"]
  },
  selfie: {
    id: "MASCOT-16",
    key: "selfie",
    filename: "LS-mascot_16_selfie.png",
    source: mascot16Selfie,
    title: "Kiri Taking Evidence Photo",
    alt: "Kiri holding a camera to capture check-in custody evidence and KYC documents",
    tone: "Photo evidence, KYC document capture",
    primaryScreens: ["TM-042", "HM-004", "HM-022", "HM-023"]
  },
  "king-coconut": {
    id: "MASCOT-17",
    key: "king-coconut",
    filename: "LS-mascot_17_king-coconut.png",
    source: mascot17KingCoconut,
    title: "Kiri Sipping King Coconut",
    alt: "Kiri relaxing with a fresh Sri Lankan Thambili king coconut while bags are stored",
    tone: "Hands-free relaxation, island leisure",
    primaryScreens: ["TM-044", "HM-029", "HM-031"]
  },
  salute: {
    id: "MASCOT-18",
    key: "salute",
    filename: "LS-mascot_18_salute.png",
    source: mascot18Salute,
    title: "Kiri Giving a Duty Salute",
    alt: "Kiri giving a crisp salute for host operations and platform command",
    tone: "Operational readiness, compliance, duty",
    primaryScreens: ["HM-006", "HM-036", "HM-037"]
  },
  shrug: {
    id: "MASCOT-19",
    key: "shrug",
    filename: "LS-mascot_19_shrug.png",
    source: mascot19Shrug,
    title: "Kiri Shrugging Empathetically",
    alt: "Kiri shrugging empathetically for error states, cancellations, or disputed releases",
    tone: "Apologetic error state, cancellation, dispute",
    primaryScreens: ["TM-023", "TM-031", "TM-032", "HM-028"]
  },
  "sitting-suitcase": {
    id: "MASCOT-20",
    key: "sitting-suitcase",
    filename: "LS-mascot_20_sitting-suitcase.png",
    source: mascot20SittingSuitcase,
    title: "Kiri Sitting on Suitcase Waiting",
    alt: "Kiri sitting patiently on top of a suitcase while awaiting approval or status updates",
    tone: "Waiting for approval, polling, queue standby",
    primaryScreens: ["TM-021", "TM-022", "TM-033", "TM-041", "HM-005"]
  }
};

export const ALL_MOBILE_MASCOT_KEYS = Object.keys(MOBILE_MASCOT_CATALOGUE) as MascotKey[];

export function getMobileMascotMeta(key: MascotKey): MobileMascotAssetMeta {
  return MOBILE_MASCOT_CATALOGUE[key];
}

