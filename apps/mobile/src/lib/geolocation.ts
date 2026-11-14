export type GeolocationResult =
  | {
      ok: true;
      latitude: number;
      longitude: number;
    }
  | {
      ok: false;
      denied: boolean;
      reason: string;
    };

type GeolocationPositionLike = {
  coords?: {
    latitude?: number;
    longitude?: number;
  };
};

type GeolocationErrorLike = {
  code?: number;
  message?: string;
};

type NavigatorWithGeolocation = {
  geolocation?: {
    getCurrentPosition: (
      success: (position: GeolocationPositionLike) => void,
      error?: (err: GeolocationErrorLike) => void,
      options?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number }
    ) => void;
  };
};

/**
 * Resolves the device's current coordinates via the cross-platform `navigator.geolocation` API
 * without adding extra native location SDK dependencies. Fails closed into a typed denial/error result.
 */
export async function getCurrentDeviceLocation(timeoutMs = 10000): Promise<GeolocationResult> {
  const nav = (globalThis as { navigator?: NavigatorWithGeolocation }).navigator;
  if (!nav?.geolocation || typeof nav.geolocation.getCurrentPosition !== "function") {
    return {
      ok: false,
      denied: false,
      reason: "Device location services are not available in this runtime. Search by city or area instead."
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: GeolocationResult) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    const timer = setTimeout(() => {
      finish({
        ok: false,
        denied: false,
        reason: "Location lookup timed out. Search by city or try again outdoors."
      });
    }, timeoutMs + 500);

    try {
      nav.geolocation!.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          const lat = pos?.coords?.latitude;
          const lng = pos?.coords?.longitude;
          if (typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng)) {
            finish({ ok: true, latitude: lat, longitude: lng });
          } else {
            finish({
              ok: false,
              denied: false,
              reason: "Received invalid coordinates from device GPS."
            });
          }
        },
        (err) => {
          clearTimeout(timer);
          const isDenied = err?.code === 1;
          finish({
            ok: false,
            denied: isDenied,
            reason: isDenied
              ? "Location permission was denied. Enter a city or street in Sri Lanka instead."
              : err?.message || "Unable to read your current location."
          });
        },
        {
          enableHighAccuracy: false,
          timeout: timeoutMs,
          maximumAge: 60000
        }
      );
    } catch (error) {
      clearTimeout(timer);
      finish({
        ok: false,
        denied: false,
        reason: error instanceof Error ? error.message : "Unable to access device location."
      });
    }
  });
}
