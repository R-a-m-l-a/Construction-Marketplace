import { Router, type IRouter } from "express";
import {
  GeocodeLocationResponse,
  FindNearbyPlacesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const SOURCE_NOTICE =
  "Results are sourced from OpenStreetMap. Coverage varies by area and may be incomplete.";

type NominatimResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

type OverpassElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string | undefined>;
};

function queryString(value: unknown): string | undefined {
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
}

function parseCoordinate(value: unknown, min: number, max: number): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null;
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      "user-agent": "Buildora/1.0 (free-first construction discovery MVP)",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    throw new Error(`Upstream responded with ${response.status}`);
  }

  return (await response.json()) as T;
}

function haversineKm(
  firstLatitude: number,
  firstLongitude: number,
  secondLatitude: number,
  secondLongitude: number,
): number {
  const radiusKm = 6371;
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = radians(secondLatitude - firstLatitude);
  const longitudeDelta = radians(secondLongitude - firstLongitude);
  const first = radians(firstLatitude);
  const second = radians(secondLatitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.sin(longitudeDelta / 2) ** 2 * Math.cos(first) * Math.cos(second);
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function categoryFor(tags: Record<string, string | undefined>): string | null {
  const shop = tags.shop;
  const office = tags.office;
  const craft = tags.craft;

  if (office === "architect") return "Architect";
  if (office === "engineering") return "Civil engineer";
  if (office === "interior_design") return "Interior design";
  if (craft === "builder") return "Contractor";
  if (craft === "electrician" || shop === "electrical") return "Electrical";
  if (craft === "plumber" || shop === "plumbing") return "Plumbing";
  if (craft === "tiler" || shop === "tiles") return "Tile store";
  if (craft === "painter" || shop === "paint") return "Paint store";
  if (shop === "sanitary" || shop === "bathroom_furnishing") return "Sanitary store";
  if (
    shop === "hardware" ||
    shop === "trade" ||
    shop === "doityourself" ||
    shop === "building_materials"
  ) {
    return "Material supplier";
  }

  return null;
}

function addressFor(tags: Record<string, string | undefined>): string | null {
  if (tags["addr:full"]) return tags["addr:full"];

  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"],
    tags["addr:city"],
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(", ") : null;
}

router.get("/locations/geocode", async (req, res): Promise<void> => {
  const query = queryString(req.query.query)?.trim();

  if (!query || query.length < 2) {
    res.status(400).json({ error: "Enter a city, area, landmark, or address." });
    return;
  }

  try {
    const search = new URLSearchParams({
      q: query,
      format: "jsonv2",
      limit: "1",
      addressdetails: "0",
      countrycodes: "pk",
      "accept-language": "en",
    });
    const results = await fetchJson<NominatimResult[]>(
      `${NOMINATIM_URL}?${search.toString()}`,
    );
    const result = results[0];
    const latitude = parseCoordinate(result?.lat, -90, 90);
    const longitude = parseCoordinate(result?.lon, -180, 180);

    if (!result?.display_name || latitude === null || longitude === null) {
      res.status(404).json({
        error: "We couldn't find that location. Try a nearby city, area or landmark.",
      });
      return;
    }

    res.json(
      GeocodeLocationResponse.parse({
        displayName: result.display_name,
        latitude,
        longitude,
        source: "OpenStreetMap Nominatim",
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Location geocoding failed");
    res.status(502).json({
      error: "Location services are temporarily unavailable. Please try again.",
    });
  }
});

router.get("/locations/nearby", async (req, res): Promise<void> => {
  const latitude = parseCoordinate(req.query.latitude, -90, 90);
  const longitude = parseCoordinate(req.query.longitude, -180, 180);
  const rawRadius = Number(queryString(req.query.radiusMeters) ?? 5000);
  const radiusMeters = Number.isFinite(rawRadius)
    ? Math.min(Math.max(Math.round(rawRadius), 500), 10_000)
    : 5000;
  const category = queryString(req.query.category);

  if (latitude === null || longitude === null) {
    res.status(400).json({ error: "A valid latitude and longitude are required." });
    return;
  }

  const overpassQuery = `[out:json][timeout:25];
(
  nwr["shop"~"hardware|trade|doityourself|building_materials|tiles|paint|bathroom_furnishing|sanitary|plumbing|electrical"](around:${radiusMeters},${latitude},${longitude});
  nwr["office"~"architect|engineering|interior_design"](around:${radiusMeters},${latitude},${longitude});
  nwr["craft"~"builder|electrician|plumber|tiler|painter"](around:${radiusMeters},${latitude},${longitude});
);
out center tags;`;

  try {
    const payload = await fetchJson<{ elements?: OverpassElement[] }>(
      OVERPASS_URL,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(overpassQuery)}`,
      },
    );

    const seen = new Set<string>();
    const places = (payload.elements ?? [])
      .map((element) => {
        const tags = element.tags ?? {};
        const name = tags.name ?? tags.brand ?? tags.operator;
        const placeLatitude = element.lat ?? element.center?.lat;
        const placeLongitude = element.lon ?? element.center?.lon;
        const placeCategory = categoryFor(tags);

        if (
          !name ||
          !placeCategory ||
          placeLatitude === undefined ||
          placeLongitude === undefined ||
          element.id === undefined ||
          !element.type
        ) {
          return null;
        }

        const id = `${element.type}-${element.id}`;
        if (seen.has(id)) return null;
        seen.add(id);

        return {
          id,
          name,
          category: placeCategory,
          latitude: placeLatitude,
          longitude: placeLongitude,
          distanceKm: Number(
            haversineKm(latitude, longitude, placeLatitude, placeLongitude).toFixed(1),
          ),
          address: addressFor(tags),
          phone: tags.phone ?? tags["contact:phone"] ?? null,
          website: tags.website ?? tags["contact:website"] ?? null,
          osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
        };
      })
      .filter((place): place is NonNullable<typeof place> => place !== null)
      .filter((place) => !category || place.category === category)
      .sort((first, second) => (first.distanceKm ?? 0) - (second.distanceKm ?? 0))
      .slice(0, 80);

    res.json(
      FindNearbyPlacesResponse.parse({
        center: {
          displayName: "Selected location",
          latitude,
          longitude,
          source: "Buildora map search",
        },
        places,
        source: "OpenStreetMap Overpass",
        sourceNotice: SOURCE_NOTICE,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Nearby location search failed");
    res.status(502).json({
      error: "Location services are temporarily unavailable. Please try again.",
    });
  }
});

export default router;