import { Router, type IRouter } from "express";
import {
  GeocodeLocationResponse,
  FindNearbyPlacesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// Public Overpass mirrors — tried in order. Public instances are often slow
// or rate-limited; we fail over quickly rather than hanging the request.
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

const SOURCE_NOTICE =
  "Results are sourced from OpenStreetMap. Coverage varies by area and may be incomplete.";

const FALLBACK_NOTICE =
  "Live OpenStreetMap search is temporarily unavailable. Showing curated starting points for this area — verify details before visiting.";

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

type PlaceRow = {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  address: string | null;
  phone: string | null;
  website: string | null;
  osmUrl: string | null;
};

/** Curated construction-related starting points for major Pakistani cities.
 * Used only when every Overpass mirror fails, so the map is never empty. */
const PAKISTAN_FALLBACKS: Array<{
  city: string;
  latitude: number;
  longitude: number;
  places: Array<{
    name: string;
    category: string;
    latitude: number;
    longitude: number;
    address?: string;
  }>;
}> = [
  {
    city: "Islamabad",
    latitude: 33.6844,
    longitude: 73.0479,
    places: [
      {
        name: "I-9 Industrial Area hardware cluster",
        category: "Material supplier",
        latitude: 33.6585,
        longitude: 73.0558,
        address: "I-9 Industrial Area, Islamabad",
      },
      {
        name: "Blue Area building supplies",
        category: "Material supplier",
        latitude: 33.7077,
        longitude: 73.0532,
        address: "Blue Area, Islamabad",
      },
      {
        name: "G-11 Markaz sanitary & tiles",
        category: "Tile store",
        latitude: 33.6686,
        longitude: 72.9995,
        address: "G-11 Markaz, Islamabad",
      },
      {
        name: "F-10 electrical & hardware",
        category: "Electrical",
        latitude: 33.6951,
        longitude: 73.0129,
        address: "F-10 Markaz, Islamabad",
      },
    ],
  },
  {
    city: "Rawalpindi",
    latitude: 33.5651,
    longitude: 73.0169,
    places: [
      {
        name: "Saddar hardware market",
        category: "Material supplier",
        latitude: 33.5973,
        longitude: 73.0515,
        address: "Saddar, Rawalpindi",
      },
      {
        name: "Committee Chowk building materials",
        category: "Material supplier",
        latitude: 33.6058,
        longitude: 73.0672,
        address: "Committee Chowk, Rawalpindi",
      },
    ],
  },
  {
    city: "Lahore",
    latitude: 31.5204,
    longitude: 74.3587,
    places: [
      {
        name: "Hall Road electrical market",
        category: "Electrical",
        latitude: 31.5622,
        longitude: 74.3162,
        address: "Hall Road, Lahore",
      },
      {
        name: "Brandreth Road hardware",
        category: "Material supplier",
        latitude: 31.5685,
        longitude: 74.3198,
        address: "Brandreth Road, Lahore",
      },
      {
        name: "Timber Market Ravi Road",
        category: "Material supplier",
        latitude: 31.5891,
        longitude: 74.3012,
        address: "Ravi Road, Lahore",
      },
    ],
  },
  {
    city: "Peshawar",
    latitude: 34.0151,
    longitude: 71.5249,
    places: [
      {
        name: "GT Road hardware & steel",
        category: "Material supplier",
        latitude: 34.0021,
        longitude: 71.5445,
        address: "GT Road, Peshawar",
      },
      {
        name: "University Road sanitary stores",
        category: "Sanitary store",
        latitude: 34.0015,
        longitude: 71.4851,
        address: "University Road, Peshawar",
      },
      {
        name: "Saddar building supplies",
        category: "Material supplier",
        latitude: 34.0084,
        longitude: 71.5731,
        address: "Saddar, Peshawar",
      },
    ],
  },
  {
    city: "Karachi",
    latitude: 24.8607,
    longitude: 67.0011,
    places: [
      {
        name: "Jodia Bazaar hardware",
        category: "Material supplier",
        latitude: 24.8521,
        longitude: 67.0045,
        address: "Jodia Bazaar, Karachi",
      },
      {
        name: "Timber Market SITE",
        category: "Material supplier",
        latitude: 24.9052,
        longitude: 66.9918,
        address: "SITE Area, Karachi",
      },
    ],
  },
];

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
  timeoutMs = 12_000,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      "user-agent": "QadeerBuilds/1.0 (free-first construction discovery MVP)",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
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

function mapOverpassElements(
  elements: OverpassElement[],
  latitude: number,
  longitude: number,
  category?: string,
): PlaceRow[] {
  const seen = new Set<string>();
  const places: PlaceRow[] = [];

  for (const element of elements) {
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
      continue;
    }

    const id = `${element.type}-${element.id}`;
    if (seen.has(id)) continue;
    seen.add(id);

    places.push({
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
    });
  }

  return places
    .filter((place) => !category || place.category === category)
    .sort((first, second) => first.distanceKm - second.distanceKm)
    .slice(0, 80);
}

function fallbackPlaces(
  latitude: number,
  longitude: number,
  category?: string,
): PlaceRow[] {
  // Pick the closest curated city within ~80 km
  let best: (typeof PAKISTAN_FALLBACKS)[number] | null = null;
  let bestDistance = Infinity;

  for (const city of PAKISTAN_FALLBACKS) {
    const d = haversineKm(latitude, longitude, city.latitude, city.longitude);
    if (d < bestDistance) {
      bestDistance = d;
      best = city;
    }
  }

  if (!best || bestDistance > 80) return [];

  const selected = best;
  const places: PlaceRow[] = selected.places.map((place, index) => ({
    id: `fallback-${selected.city}-${index}`,
    name: place.name,
    category: place.category,
    latitude: place.latitude,
    longitude: place.longitude,
    distanceKm: Number(
      haversineKm(latitude, longitude, place.latitude, place.longitude).toFixed(1),
    ),
    address: place.address ?? null,
    phone: null,
    website: null,
    osmUrl: null,
  }));

  return places
    .filter((place) => !category || place.category === category)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

async function queryOverpass(
  overpassQuery: string,
): Promise<OverpassElement[]> {
  let lastError: unknown;

  for (const url of OVERPASS_URLS) {
    try {
      const payload = await fetchJson<{ elements?: OverpassElement[] }>(
        url,
        {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(overpassQuery)}`,
        },
        10_000,
      );
      return payload.elements ?? [];
    } catch (error) {
      lastError = error;
      // Try the next mirror
    }
  }

  throw lastError ?? new Error("All Overpass mirrors failed");
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
      undefined,
      15_000,
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

  // Leaner query: nodes first (faster than full nwr), common construction tags.
  const overpassQuery = `[out:json][timeout:10];
(
  node["shop"~"hardware|trade|doityourself|building_materials|tiles|paint|bathroom_furnishing|sanitary|plumbing|electrical"](around:${radiusMeters},${latitude},${longitude});
  node["office"~"architect|engineering|interior_design"](around:${radiusMeters},${latitude},${longitude});
  node["craft"~"builder|electrician|plumber|tiler|painter"](around:${radiusMeters},${latitude},${longitude});
  way["shop"~"hardware|building_materials|doityourself"](around:${radiusMeters},${latitude},${longitude});
);
out center tags;`;

  try {
    const elements = await queryOverpass(overpassQuery);
    const places = mapOverpassElements(elements, latitude, longitude, category);

    res.json(
      FindNearbyPlacesResponse.parse({
        center: {
          displayName: "Selected location",
          latitude,
          longitude,
          source: "QadeerBuilds map search",
        },
        places,
        source: "OpenStreetMap Overpass",
        sourceNotice: SOURCE_NOTICE,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Nearby location search failed — using fallback");

    // Never leave the UI hanging on a 502. Prefer curated local starting
    // points so testers in Pakistan still see something useful.
    const places = fallbackPlaces(latitude, longitude, category);

    res.json(
      FindNearbyPlacesResponse.parse({
        center: {
          displayName: "Selected location",
          latitude,
          longitude,
          source: "QadeerBuilds map search",
        },
        places,
        source: places.length > 0 ? "QadeerBuilds curated fallback" : "OpenStreetMap Overpass",
        sourceNotice: places.length > 0 ? FALLBACK_NOTICE : SOURCE_NOTICE,
      }),
    );
  }
});

export default router;