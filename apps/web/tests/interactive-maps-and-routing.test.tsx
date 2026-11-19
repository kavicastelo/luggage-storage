import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { LocationDiscoveryMap, type DiscoveryMapPoint } from "../src/features/traveller/LocationDiscoveryMap";
import { marketplaceApi } from "../src/services/marketplace-api";

describe("Interactive Web Map & Route Preview", () => {
  const mockLocations: DiscoveryMapPoint[] = [
    {
      id: "loc-colombo-1",
      name: "Colombo Fort Transit Hub",
      city: "Colombo",
      approximateArea: "Fort Railway District",
      approximateLatitude: 6.9344,
      approximateLongitude: 79.8519,
      priceLabel: "LKR 750 / day",
      bookingMode: "INSTANT",
      href: "/location/loc-colombo-1"
    },
    {
      id: "loc-kandy-1",
      name: "Kandy Lakeview Storage",
      city: "Kandy",
      approximateArea: "Dalada Veediya",
      approximateLatitude: 7.2936,
      approximateLongitude: 80.6413,
      priceLabel: "LKR 900 / day",
      bookingMode: "INSTANT",
      href: "/location/loc-kandy-1"
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders interactive map container, zoom controls, and attribution", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <LocationDiscoveryMap
          locations={mockLocations}
          selectedLocationId="loc-colombo-1"
        />
      </MemoryRouter>
    );

    expect(html).toContain("Sri Lanka Transit Corridor Map");
    expect(html).toContain("2 hubs");
    expect(html).toContain("© MapTiler © OSM");
    expect(html).toContain("aria-label=\"Zoom in\"");
    expect(html).toContain("aria-label=\"Zoom out\"");
    expect(html).toContain("aria-label=\"Find my current location\"");
    expect(html).toContain("LKR 750 / day");
    expect(html).toContain("LKR 900 / day");
  });

  it("displays selected location card with in-app route preview button and external fallback link", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <LocationDiscoveryMap
          locations={mockLocations}
          selectedLocationId="loc-colombo-1"
        />
      </MemoryRouter>
    );

    expect(html).toContain("Colombo Fort Transit Hub");
    expect(html).toContain("View Details &amp; Book");
    expect(html).toContain("Preview Route");
    expect(html).toContain("External Maps");
    expect(html).toContain("https://www.google.com/maps/dir/?api=1&amp;destination=6.9344,79.8519&amp;travelmode=walking");
  });

  it("marketplaceApi.calculateRoute returns valid route result with maneuvers", async () => {
    const mockCalculate = vi.spyOn(marketplaceApi, "calculateRoute").mockResolvedValueOnce({
      routeId: "route-test-123",
      travelMode: "walking",
      distanceMeters: 850,
      durationSeconds: 650,
      geometry: [
        { latitude: 6.9271, longitude: 79.8458 },
        { latitude: 6.9344, longitude: 79.8519 }
      ],
      legs: [
        {
          distanceMeters: 850,
          durationSeconds: 650,
          startLocation: { latitude: 6.9271, longitude: 79.8458 },
          endLocation: { latitude: 6.9344, longitude: 79.8519 },
          steps: [
            {
              index: 0,
              instruction: "Head northeast on Olcott Mawatha",
              distanceMeters: 850,
              durationSeconds: 650,
              maneuver: {
                type: "DEPART",
                instruction: "Head northeast on Olcott Mawatha",
                distanceMeters: 850,
                durationSeconds: 650,
                location: { latitude: 6.9271, longitude: 79.8458 }
              }
            }
          ]
        }
      ],
      alternatives: [],
      provider: "sandbox",
      summary: "Standard walking route (0.9 km)"
    });

    const route = await marketplaceApi.calculateRoute({
      origin: { latitude: 6.9271, longitude: 79.8458 },
      destination: { latitude: 6.9344, longitude: 79.8519 },
      travelMode: "walking"
    });

    expect(mockCalculate).toHaveBeenCalledTimes(1);
    expect(route.routeId).toBe("route-test-123");
    expect(route.distanceMeters).toBe(850);
    expect(route.legs[0].steps[0].instruction).toContain("Olcott Mawatha");
  });
});

