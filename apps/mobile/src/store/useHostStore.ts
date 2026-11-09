import { create } from "zustand";
import {
  DEMO_HOST_BOOKINGS,
  DEMO_HOST_HUB,
  DEMO_HOST_TRANSACTIONS,
  DEMO_PIN_LOOKUPS,
  DEMO_QR_LOOKUPS,
  DemoHostBooking,
  DemoHostHubInfo,
  DemoHostTransaction
} from "../data/mock-host-data";

export interface IntakeSessionState {
  booking: DemoHostBooking | null;
  reconciledBags: number;
  sealNumber: string;
  photoCaptured: boolean;
  photoBypassed: boolean;
  assignedZone: string;
  staffNotes: string;
}

const DEFAULT_INTAKE_SESSION: IntakeSessionState = {
  booking: null,
  reconciledBags: 1,
  sealNumber: "",
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

  // Actions
  lookupByPin: (pin: string) => DemoHostBooking | null;
  lookupByQr: (payload: string) => DemoHostBooking | null;
  startIntake: (booking: DemoHostBooking) => void;
  updateIntake: (partial: Partial<IntakeSessionState>) => void;
  confirmIntake: () => { success: boolean; bookingRef: string; message: string } | null;
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

  lookupByPin: (pin: string) => {
    const cleaned = pin.replace(/\s+/g, "").trim();
    if (DEMO_PIN_LOOKUPS[cleaned]) {
      return DEMO_PIN_LOOKUPS[cleaned];
    }
    // Also check current store bookings by pinCode
    const found = get().bookings.find((b) => b.pinCode === cleaned);
    return found || null;
  },

  lookupByQr: (payload: string) => {
    const trimmed = payload.trim();
    if (DEMO_QR_LOOKUPS[trimmed]) {
      return DEMO_QR_LOOKUPS[trimmed];
    }
    // Extract reference if present (e.g. LS-2026-8841)
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
        sealNumber: booking.sealNumbers[0] || `SEAL-LK-${Math.floor(10000 + Math.random() * 90000)}`,
        photoCaptured: false,
        photoBypassed: false,
        assignedZone: booking.zoneCode || "RACK-A",
        staffNotes: booking.notes || ""
      }
    });
  },

  updateIntake: (partial: Partial<IntakeSessionState>) => {
    set((state) => ({
      intakeSession: {
        ...state.intakeSession,
        ...partial
      }
    }));
  },

  confirmIntake: () => {
    const session = get().intakeSession;
    if (!session.booking) return null;

    const targetId = session.booking.id;
    const sealList = session.sealNumber ? [session.sealNumber] : [];

    set((state) => {
      const updatedBookings = state.bookings.map((b) => {
        if (b.id === targetId) {
          return {
            ...b,
            status: "IN_STORAGE" as const,
            totalBags: session.reconciledBags,
            sealNumbers: sealList,
            zoneCode: session.assignedZone,
            photoEvidenceCaptured: session.photoCaptured,
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

    return {
      success: true,
      bookingRef: session.booking.reference,
      message: `Intake Complete: Luggage for booking ${session.booking.reference} logged into Vault Zone ${session.assignedZone}. Tamper seal ${session.sealNumber} applied. (Local Prototype Simulation)`
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
      message: `Baggage Released: Custody cleared for ${booking.reference} (${booking.travellerName}). Returned ${booking.totalBags} bags. (Local Prototype Simulation)`
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
      intakeSession: { ...DEFAULT_INTAKE_SESSION }
    });
  }
}));
