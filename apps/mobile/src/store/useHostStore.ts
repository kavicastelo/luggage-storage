import { create } from "zustand";
import {
  DEMO_HOST_BOOKINGS,
  DEMO_HOST_HUB,
  DEMO_HOST_TRANSACTIONS,
  DEMO_PIN_LOOKUPS,
  DEMO_QR_LOOKUPS,
  DemoHostBooking,
  DemoHostHubInfo,
  DemoHostTransaction,
  PhotoEvidenceStatus
} from "../data/mock-host-data";

export interface IntakeSessionState {
  booking: DemoHostBooking | null;
  reconciledBags: number;
  sealNumber: string;
  sealIsDemoPlaceholder: boolean;
  photoEvidenceStatus: PhotoEvidenceStatus;
  photoUri: string | null;
  photoCaptured: boolean;
  photoBypassed: boolean;
  assignedZone: string;
  staffNotes: string;
}

const DEFAULT_INTAKE_SESSION: IntakeSessionState = {
  booking: null,
  reconciledBags: 1,
  sealNumber: "",
  sealIsDemoPlaceholder: false,
  photoEvidenceStatus: "NOT_PROVIDED",
  photoUri: null,
  photoCaptured: false,
  photoBypassed: false,
  assignedZone: "RACK-A",
  staffNotes: ""
};

export interface HostStoreState {
  hub: DemoHostHubInfo;
  bookings: DemoHostBooking[];
  transactions: DemoHostTransaction[];
  intakeSession: IntakeSessionState;
  activeDemoRole: "HOST_OWNER" | "HOST_STAFF";

  // Actions
  setActiveDemoRole: (role: "HOST_OWNER" | "HOST_STAFF") => void;
  lookupByPin: (pin: string) => DemoHostBooking | null;
  lookupByQr: (payload: string) => DemoHostBooking | null;
  startIntake: (booking: DemoHostBooking) => void;
  updateIntake: (partial: Partial<IntakeSessionState>) => void;
  confirmIntake: () => { success: boolean; bookingRef: string; message: string };
  cancelIntake: () => void;
  releaseLuggage: (bookingId: string) => { success: boolean; message: string };
  approveRequest: (bookingId: string) => void;
  declineRequest: (bookingId: string) => void;
  resetToDefaults: () => void;
}

export const useHostStore = create<HostStoreState>((set, get) => ({
  hub: DEMO_HOST_HUB,
  bookings: [...DEMO_HOST_BOOKINGS],
  transactions: [...DEMO_HOST_TRANSACTIONS],
  intakeSession: { ...DEFAULT_INTAKE_SESSION },
  activeDemoRole: "HOST_OWNER",

  setActiveDemoRole: (role: "HOST_OWNER" | "HOST_STAFF") => {
    set({ activeDemoRole: role });
  },

  lookupByPin: (pin: string) => {
    if (!pin) return null;
    const cleaned = pin.replace(/\s+/g, "").trim();
    if (cleaned.length !== 6 || !/^\d{6}$/.test(cleaned)) {
      return null;
    }
    if (DEMO_PIN_LOOKUPS[cleaned]) {
      return DEMO_PIN_LOOKUPS[cleaned];
    }
    const found = get().bookings.find((b) => b.pinCode === cleaned);
    return found || null;
  },

  lookupByQr: (payload: string) => {
    if (!payload) return null;
    const trimmed = payload.trim();
    if (!trimmed) return null;

    if (DEMO_QR_LOOKUPS[trimmed]) {
      return DEMO_QR_LOOKUPS[trimmed];
    }
    // Match by exact reference if present
    const match = trimmed.match(/LS-\d{4}-\d{4}/);
    if (match) {
      const found = get().bookings.find((b) => b.reference === match[0]);
      if (found) return found;
    }
    const foundByPayload = get().bookings.find((b) => b.qrPayload === trimmed);
    return foundByPayload || null;
  },

  startIntake: (booking: DemoHostBooking) => {
    set({
      intakeSession: {
        booking,
        reconciledBags: booking.totalBags,
        // Invariant DEC-007: Do NOT auto-preassign random seal! Require operator action.
        sealNumber: booking.sealNumbers[0] || "",
        sealIsDemoPlaceholder: false,
        photoEvidenceStatus: booking.photoEvidenceCaptured ? "CAPTURED_LOCAL" : "NOT_PROVIDED",
        photoUri: booking.photoUri || null,
        photoCaptured: Boolean(booking.photoUri),
        photoBypassed: booking.photoEvidenceStatus === "SKIPPED_PENDING_POLICY",
        assignedZone: booking.zoneCode || "RACK-A",
        staffNotes: booking.notes || ""
      }
    });
  },

  updateIntake: (partial: Partial<IntakeSessionState>) => {
    set((state) => {
      const merged = {
        ...state.intakeSession,
        ...partial
      };

      // Strict Invariant: photoCaptured is true ONLY if photoUri exists and status is CAPTURED_LOCAL
      if (merged.photoUri && merged.photoEvidenceStatus === "CAPTURED_LOCAL") {
        merged.photoCaptured = true;
        merged.photoBypassed = false;
      } else if (merged.photoEvidenceStatus === "SKIPPED_PENDING_POLICY") {
        merged.photoCaptured = false;
        merged.photoBypassed = true;
        merged.photoUri = null;
      } else {
        merged.photoCaptured = false;
      }

      return { intakeSession: merged };
    });
  },

  confirmIntake: () => {
    const session = get().intakeSession;
    if (!session.booking) {
      return {
        success: false,
        bookingRef: "",
        message: "No active intake session booking selected."
      };
    }

    const targetId = session.booking.id;
    const current = get().bookings.find((b) => b.id === targetId);

    // Guard against repeated or invalid transitions
    if (!current) {
      return {
        success: false,
        bookingRef: session.booking.reference,
        message: "Booking record does not exist in local database."
      };
    }

    if (current.status === "COMPLETED") {
      return {
        success: false,
        bookingRef: session.booking.reference,
        message: "Cannot perform intake: Booking custody has already been completed and released."
      };
    }

    if (current.status === "CANCELLED") {
      return {
        success: false,
        bookingRef: session.booking.reference,
        message: "Cannot perform intake: Booking was cancelled."
      };
    }

    const sealList = session.sealNumber.trim() ? [session.sealNumber.trim()] : [];
    const isPhotoCaptured = Boolean(
      session.photoUri && session.photoEvidenceStatus === "CAPTURED_LOCAL"
    );

    set((state) => {
      const updatedBookings = state.bookings.map((b) => {
        if (b.id === targetId) {
          return {
            ...b,
            status: "IN_STORAGE" as const,
            totalBags: session.reconciledBags,
            sealNumbers: sealList,
            zoneCode: session.assignedZone,
            photoEvidenceCaptured: isPhotoCaptured,
            photoEvidenceStatus: session.photoEvidenceStatus,
            photoUri: session.photoUri,
            notes: session.staffNotes || b.notes
          };
        }
        return b;
      });

      return {
        bookings: updatedBookings,
        intakeSession: { ...DEFAULT_INTAKE_SESSION }
      };
    });

    const sealDesc = session.sealNumber.trim()
      ? `Tag ${session.sealNumber} recorded${session.sealIsDemoPlaceholder ? " (Demo placeholder)" : ""}.`
      : "No seal recorded.";

    const photoDesc = isPhotoCaptured
      ? "Local photo evidence saved."
      : session.photoBypassed
      ? "Photo evidence skipped (DEC-001 Pending Sign-Off)."
      : "No photo provided.";

    return {
      success: true,
      bookingRef: session.booking.reference,
      message: `Intake Complete: Luggage for booking ${session.booking.reference} logged into Vault Zone ${session.assignedZone}. ${sealDesc} ${photoDesc} (Local Prototype Simulation)`
    };
  },

  cancelIntake: () => {
    set({ intakeSession: { ...DEFAULT_INTAKE_SESSION } });
  },

  releaseLuggage: (bookingId: string) => {
    const booking = get().bookings.find((b) => b.id === bookingId);
    if (!booking) {
      return { success: false, message: "Booking record not found in vault." };
    }

    if (booking.status === "COMPLETED") {
      return {
        success: false,
        message: `Luggage for ${booking.reference} has already been released and custody cleared.`
      };
    }

    if (booking.status === "CANCELLED") {
      return {
        success: false,
        message: `Cannot release luggage: Booking ${booking.reference} was cancelled.`
      };
    }

    if (booking.status === "CONFIRMED") {
      return {
        success: false,
        message: `Cannot release luggage: Booking ${booking.reference} has not completed intake yet.`
      };
    }

    set((state) => ({
      bookings: state.bookings.map((b) => {
        if (b.id === bookingId) {
          return {
            ...b,
            status: "COMPLETED" as const
          };
        }
        return b;
      })
    }));

    return {
      success: true,
      message: `Baggage Released: Custody cleared for ${booking.reference} (${booking.travellerName}). Handed over ${booking.totalBags} bags. (Local Prototype Simulation — DEC-002: No fee collected in demo)`
    };
  },

  approveRequest: (bookingId: string) => {
    set((state) => ({
      bookings: state.bookings.map((b) => {
        if (b.id === bookingId) {
          return { ...b, status: "CONFIRMED" as const };
        }
        return b;
      })
    }));
  },

  declineRequest: (bookingId: string) => {
    set((state) => ({
      bookings: state.bookings.map((b) => {
        if (b.id === bookingId) {
          return { ...b, status: "CANCELLED" as const };
        }
        return b;
      })
    }));
  },

  resetToDefaults: () => {
    set({
      hub: DEMO_HOST_HUB,
      bookings: [...DEMO_HOST_BOOKINGS],
      transactions: [...DEMO_HOST_TRANSACTIONS],
      intakeSession: { ...DEFAULT_INTAKE_SESSION },
      activeDemoRole: "HOST_OWNER"
    });
  }
}));
