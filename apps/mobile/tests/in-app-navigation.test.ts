import { describe, it, expect, vi } from "vitest";
import type { RouteResult } from "@luggage-storage/contracts";
import { calculateHaversineDistanceMeters } from "../../api/src/modules/maps/sandbox-routing.adapter";

describe("Mobile In-App Navigation Engine", () => {
  it("calculates accurate distance between coordinates in Sri Lanka", () => {
    // Colombo Fort Station to Galle Face Green (~1.1 km)
    const fortStation = { latitude: 6.9344, longitude: 79.8519 };
    const galleFace = { latitude: 6.9271, longitude: 79.8458 };

    const distance = calculateHaversineDistanceMeters(fortStation, galleFace);
    expect(distance).toBeGreaterThan(900);
    expect(distance).toBeLessThan(1400);
  });

  it("detects arrival when within 25 meters", () => {
    const facility = { latitude: 6.9344, longitude: 79.8519 };
    // Close location within ~10m
    const travellerAtDoor = { latitude: 6.93448, longitude: 79.85192 };

    const dist = calculateHaversineDistanceMeters(facility, travellerAtDoor);
    expect(dist).toBeLessThanOrEqual(25);
  });

  it("detects off-route deviation when distance exceeds 45 meters", () => {
    const routeWaypoint = { latitude: 6.9344, longitude: 79.8519 };
    // Waypoint 200m away on another street
    const deviatedTraveller = { latitude: 6.936, longitude: 79.853 };

    const dist = calculateHaversineDistanceMeters(routeWaypoint, deviatedTraveller);
    expect(dist).toBeGreaterThan(45);
  });

  it("formats navigation distance and duration labels accurately", () => {
    function formatDistance(meters: number): string {
      if (meters < 1000) return `${Math.round(meters)} m`;
      return `${(meters / 1000).toFixed(1)} km`;
    }

    function formatDuration(seconds: number): string {
      const mins = Math.round(seconds / 60);
      if (mins < 60) return `${mins} mins`;
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs} hr ${remMins > 0 ? `${remMins} min` : ""}`.trim();
    }

    expect(formatDistance(450)).toBe("450 m");
    expect(formatDistance(1500)).toBe("1.5 km");
    expect(formatDistance(25000)).toBe("25.0 km");

    expect(formatDuration(420)).toBe("7 mins");
    expect(formatDuration(3600)).toBe("1 hr");
    expect(formatDuration(5400)).toBe("1 hr 30 min");
  });

  it("maps maneuver types to appropriate icon tokens", () => {
    function getManeuverIcon(type?: string): string {
      switch (type) {
        case "TURN_LEFT":
        case "SHARP_LEFT":
        case "SLIGHT_LEFT":
          return "chevron-left";
        case "TURN_RIGHT":
        case "SHARP_RIGHT":
        case "SLIGHT_RIGHT":
          return "chevron-right";
        case "U_TURN":
          return "refresh-cw";
        case "ARRIVE":
          return "check-circle";
        case "DEPART":
        case "CONTINUE":
        default:
          return "arrow-up";
      }
    }

    expect(getManeuverIcon("DEPART")).toBe("arrow-up");
    expect(getManeuverIcon("TURN_LEFT")).toBe("chevron-left");
    expect(getManeuverIcon("TURN_RIGHT")).toBe("chevron-right");
    expect(getManeuverIcon("ARRIVE")).toBe("check-circle");
  });
});
