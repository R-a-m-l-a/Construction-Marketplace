import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Crosshair,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Navigation,
  Phone,
  Search,
  SlidersHorizontal,
  Store,
  X,
} from "lucide-react";
import {
  getFindNearbyPlacesQueryKey,
  getGeocodeLocationQueryKey,
  useFindNearbyPlaces,
  useGeocodeLocation,
} from "@workspace/api-client-react";
import type {
  FindNearbyPlacesParams,
  LocationResult,
  Place,
} from "@workspace/api-client-react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

type SearchStatus = "idle" | "locating" | "ready" | "denied" | "unavailable";
type PinIcons = {
  selected: L.DivIcon;
  user: L.DivIcon;
  place: L.DivIcon;
};

const PAKISTAN_CENTER: [number, number] = [30.3753, 69.3451];
const FALLBACK_NEARBY_PARAMS: FindNearbyPlacesParams = {
  latitude: PAKISTAN_CENTER[0],
  longitude: PAKISTAN_CENTER[1],
};

const categories = [
  { value: "", label: "Every construction place" },
  { value: "Material supplier", label: "Material suppliers" },
  { value: "Architect", label: "Architects" },
  { value: "Civil engineer", label: "Civil engineers" },
  { value: "Contractor", label: "Contractors" },
  { value: "Electrical", label: "Electrical" },
  { value: "Plumbing", label: "Plumbing" },
  { value: "Tile store", label: "Tile stores" },
  { value: "Paint store", label: "Paint stores" },
  { value: "Sanitary store", label: "Sanitary stores" },
];

const radiusOptions = [
  { value: 2000, label: "2 km" },
  { value: 5000, label: "5 km" },
  { value: 10000, label: "10 km" },
];

function makePinIcon(kind: "selected" | "user" | "place") {
  return L.divIcon({
    className: `buildora-pin buildora-pin--${kind}`,
    html: "<span></span>",
    iconSize: kind === "place" ? [18, 18] : [24, 24],
    iconAnchor: kind === "place" ? [9, 9] : [12, 22],
    popupAnchor: [0, kind === "place" ? -10 : -21],
  });
}

function RecenterMap({
  location,
}: {
  location: LocationResult | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (location) {
      map.flyTo([location.latitude, location.longitude], 13, {
        duration: 0.8,
      });
    }
  }, [location, map]);

  return null;
}

function formatDistance(distanceKm: number | null) {
  if (distanceKm === null) return null;
  return distanceKm < 1
    ? `${Math.round(distanceKm * 1000)} m away`
    : `${distanceKm.toFixed(1)} km away`;
}

function apiErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error && typeof error === "object") {
    const data = (error as { data?: unknown }).data;
    if (
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
    ) {
      return data.error;
    }
  }
  return fallback;
}

function PlaceDetail({
  place,
  onClose,
}: {
  place: Place;
  onClose: () => void;
}) {
  return (
    <aside
      className="location-detail rise-in-delay-2"
      aria-label={`Details for ${place.name}`}
      data-testid={`panel-place-detail-${place.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono-ui text-[9px] font-bold uppercase tracking-[0.16em] text-accent">
            Place details
          </p>
          <h3 className="mt-2 font-display text-2xl font-bold leading-tight tracking-[-0.045em]">
            {place.name}
          </h3>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {place.category}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close place details"
          data-testid="button-close-place-detail"
          className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
        {place.address && (
          <p className="flex gap-3 leading-5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-accent" />
            <span>{place.address}</span>
          </p>
        )}
        {place.phone && (
          <a
            href={`tel:${place.phone}`}
            data-testid={`link-call-place-${place.id}`}
            className="flex gap-3 leading-5 text-primary transition-colors hover:text-accent"
          >
            <Phone className="mt-0.5 size-4 shrink-0 text-accent" />
            <span>{place.phone}</span>
          </a>
        )}
        {place.website && (
          <a
            href={place.website}
            target="_blank"
            rel="noreferrer"
            data-testid={`link-website-place-${place.id}`}
            className="flex gap-3 break-all leading-5 text-primary transition-colors hover:text-accent"
          >
            <ExternalLink className="mt-0.5 size-4 shrink-0 text-accent" />
            <span>{place.website}</span>
          </a>
        )}
        {!place.address && !place.phone && !place.website && (
          <p className="text-sm leading-6 text-muted-foreground">
            No contact details are listed for this place yet.
          </p>
        )}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        {formatDistance(place.distanceKm) && (
          <span className="font-mono-ui text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            {formatDistance(place.distanceKm)}
          </span>
        )}
        <a
          href={`https://www.openstreetmap.org/directions?to=${place.latitude}%2C${place.longitude}`}
          target="_blank"
          rel="noreferrer"
          data-testid={`link-directions-place-${place.id}`}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition-transform hover:-translate-y-0.5"
        >
          <Navigation className="size-3.5" />
          Directions
        </a>
        {place.osmUrl && (
          <a
            href={place.osmUrl}
            target="_blank"
            rel="noreferrer"
            data-testid={`link-osm-place-${place.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary"
          >
            OSM
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </aside>
  );
}

function PlaceCard({
  place,
  active,
  onSelect,
}: {
  place: Place;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`card-nearby-place-${place.id}`}
      className={`group w-full rounded-xl border p-4 text-left transition-[transform,background-color,border-color] hover:-translate-y-0.5 hover:bg-muted ${
        active
          ? "border-accent/60 bg-accent/5"
          : "border-border bg-background"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${
            active ? "bg-accent text-accent-foreground" : "bg-muted text-accent"
          }`}
        >
          <Store className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="font-semibold leading-5">{place.name}</span>
            {active && <Check className="mt-0.5 size-4 shrink-0 text-accent" />}
          </span>
          <span className="mt-1 block text-xs font-medium text-accent">
            {place.category}
          </span>
          <span className="mt-2 block text-xs leading-5 text-muted-foreground">
            {place.address ?? "Address not listed"}
          </span>
          {formatDistance(place.distanceKm) && (
            <span className="mt-2 block font-mono-ui text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
              {formatDistance(place.distanceKm)}
            </span>
          )}
        </span>
      </div>
    </button>
  );
}

export function LocationDiscovery() {
  const [search, setSearch] = useState("");
  const [searchRequest, setSearchRequest] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(
    null,
  );
  const [userLocation, setUserLocation] = useState<LocationResult | null>(null);
  const [locationStatus, setLocationStatus] = useState<SearchStatus>("idle");
  const [locationRequested, setLocationRequested] = useState(false);
  const [category, setCategory] = useState("");
  const [radiusMeters, setRadiusMeters] = useState(5000);
  const [nearbyRequest, setNearbyRequest] =
    useState<FindNearbyPlacesParams | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  const geocodeParams = useMemo(
    () => ({ query: searchRequest || "Pakistan" }),
    [searchRequest],
  );
  const geocodeQuery = useGeocodeLocation(geocodeParams, {
    query: {
      enabled: searchRequest.length >= 2,
      queryKey: getGeocodeLocationQueryKey(geocodeParams),
    },
  });

  const nearbyParams = nearbyRequest ?? FALLBACK_NEARBY_PARAMS;
  const nearbyQuery = useFindNearbyPlaces(nearbyParams, {
    query: {
      enabled: Boolean(nearbyRequest),
      queryKey: getFindNearbyPlacesQueryKey(nearbyParams),
    },
  });

  const [icons, setIcons] = useState<PinIcons | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Keep all Leaflet icon work browser-only. Div icons avoid broken asset
    // paths when Vite serves the app from a nested base URL.
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "",
      iconUrl: "",
      shadowUrl: "",
    });
    setIcons({
      selected: makePinIcon("selected"),
      user: makePinIcon("user"),
      place: makePinIcon("place"),
    });
  }, []);

  useEffect(() => {
    if (!geocodeQuery.data) return;
    setSelectedLocation(geocodeQuery.data);
    setNearbyRequest({
      latitude: geocodeQuery.data.latitude,
      longitude: geocodeQuery.data.longitude,
      radiusMeters,
    });
    setSelectedPlace(null);
    setLocationStatus("ready");
  }, [geocodeQuery.data, radiusMeters]);

  const allPlaces = nearbyRequest ? nearbyQuery.data?.places ?? [] : [];
  const places = category
    ? allPlaces.filter((place) => place.category === category)
    : allPlaces;
  const sourceNotice = nearbyQuery.data?.sourceNotice;

  const submitLocation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = search.trim();
    if (trimmed.length < 2) return;
    setSearchRequest(trimmed);
    setSelectedLocation(null);
    setNearbyRequest(null);
    setSelectedPlace(null);
    setLocationStatus("idle");
    if (searchRequest === trimmed) {
      void geocodeQuery.refetch();
    }
  };

  const requestBrowserLocation = () => {
    if (locationRequested) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationRequested(true);
      setLocationStatus("unavailable");
      return;
    }
    setLocationRequested(true);
    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const result: LocationResult = {
          displayName: "Your current browser location",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: "Browser geolocation",
        };
        setUserLocation(result);
        setSelectedLocation(result);
        setNearbyRequest({
          latitude: result.latitude,
          longitude: result.longitude,
          radiusMeters,
        });
        setSelectedPlace(null);
        setLocationStatus("ready");
      },
      (error) => {
        setLocationStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const findNearby = () => {
    if (!selectedLocation) return;
    setSelectedPlace(null);
    setNearbyRequest({
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      radiusMeters,
    });
  };

  const nearbyError = nearbyQuery.error;
  const geocodeError = geocodeQuery.error;

  return (
    <section
      className="mx-auto max-w-[1240px] px-5 pb-20 sm:px-8"
      data-testid="section-location-discovery"
    >
      <div className="overflow-hidden rounded-[1.5rem] border border-primary/15 bg-[#e5ebe6] shadow-[0_24px_70px_-46px_hsl(var(--primary)/.8)]">
        <div className="paper-grid relative border-b border-primary/10 px-5 py-7 sm:px-8 sm:py-9">
          <div className="absolute -right-14 -top-20 size-56 rounded-full border-[26px] border-secondary/25" />
          <div className="relative z-10">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div>
                <p className="font-mono-ui text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                  Phase 2 / location desk
                </p>
                <h2 className="mt-3 max-w-2xl font-display text-4xl font-bold leading-[0.96] tracking-[-0.065em] text-primary sm:text-5xl">
                  Find construction services
                  <br />
                  <span className="text-accent">near you.</span>
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-6 text-primary/65 sm:text-base">
                  Set a place, then ask the map for construction-related places
                  worth checking. It is a starting list, not a promise of complete
                  local coverage.
                </p>
              </div>
              <div className="hidden min-w-[190px] border-l border-primary/15 pl-5 text-right lg:block">
                <p className="font-mono-ui text-[9px] uppercase tracking-[0.15em] text-primary/45">
                  Data desk
                </p>
                <p className="mt-2 font-display text-2xl font-bold tracking-[-0.05em] text-primary">
                  Open map
                </p>
                <p className="mt-1 text-xs leading-5 text-primary/55">
                  Search only when you are ready.
                </p>
              </div>
            </div>

            <div className="mt-7 grid gap-3 lg:grid-cols-[1fr_auto]">
              <form
                onSubmit={submitLocation}
                className="flex min-h-12 items-center rounded-xl border border-primary/15 bg-background p-1.5"
                data-testid="form-location-search"
              >
                <Search className="ml-3 size-4 shrink-0 text-muted-foreground" />
                <label htmlFor="location-search" className="sr-only">
                  Search for a city, area, landmark, or address
                </label>
                <input
                  id="location-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search city, area or location..."
                  data-testid="input-location-search"
                  className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="submit"
                  disabled={geocodeQuery.isFetching || search.trim().length < 2}
                  data-testid="button-search-location"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {geocodeQuery.isFetching ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <ArrowRight className="size-4" />
                  )}
                  <span className="hidden sm:inline">Place on map</span>
                  <span className="sm:hidden">Search</span>
                </button>
              </form>
              <button
                type="button"
                onClick={requestBrowserLocation}
                disabled={locationStatus === "locating" || locationRequested}
                data-testid="button-use-browser-location"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-primary/15 bg-background px-4 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:cursor-wait disabled:opacity-60"
              >
                {locationStatus === "locating" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Crosshair className="size-4" />
                )}
                  Use my current location
              </button>
            </div>

            {geocodeQuery.isError && (
              <div
                className="mt-3 flex flex-col gap-3 rounded-xl border border-accent/30 bg-background/75 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                data-testid="status-geocode-error"
              >
                <p className="flex gap-2 leading-5 text-primary/75">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-accent" />
                    {apiErrorMessage(
                      geocodeError,
                      "We couldn't find that location. Try a nearby city, area or landmark.",
                    )}
                </p>
                <button
                  type="button"
                  onClick={() => geocodeQuery.refetch()}
                  data-testid="button-retry-geocode"
                  className="w-fit rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                >
                  Try search again
                </button>
              </div>
            )}
            {locationStatus === "denied" && (
              <p
                className="mt-3 flex gap-2 text-sm leading-5 text-primary/70"
                data-testid="status-location-permission-denied"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-accent" />
                Location access was not allowed. You can search for a city or area
                instead.
              </p>
            )}
            {locationStatus === "unavailable" && (
              <p
                className="mt-3 flex gap-2 text-sm leading-5 text-primary/70"
                data-testid="status-location-unavailable"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-accent" />
                Your browser location is not available here. Search manually
                instead.
              </p>
            )}
          </div>
        </div>

        <div className="border-b border-primary/10 bg-background/85 p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <MapPin className="size-4 shrink-0 text-accent" />
              <span className="truncate font-semibold" data-testid="text-selected-location">
                {selectedLocation?.displayName ?? "No location selected"}
              </span>
              {selectedLocation && (
                <span className="hidden shrink-0 font-mono-ui text-[9px] uppercase tracking-[0.1em] text-muted-foreground sm:inline">
                  {selectedLocation.source}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <label className="sr-only" htmlFor="location-category">
                Construction category
              </label>
              <div className="relative">
                <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <select
                  id="location-category"
                  value={category}
                  data-testid="select-location-category"
                  className="h-10 w-full appearance-none rounded-lg border border-border bg-background pl-9 pr-7 text-xs font-semibold outline-none focus:ring-2 focus:ring-secondary sm:w-[205px]"
                  onChange={(event) => {
                    setCategory(event.target.value);
                    setSelectedPlace(null);
                  }}
                >
                  {categories.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="sr-only" htmlFor="location-radius">
                Search radius
              </label>
              <select
                id="location-radius"
                value={radiusMeters}
                onChange={(event) => setRadiusMeters(Number(event.target.value))}
                data-testid="select-location-radius"
                className="h-10 rounded-lg border border-border bg-background px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-secondary sm:w-[100px]"
              >
                {radiusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    Within {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={findNearby}
                disabled={!selectedLocation || nearbyQuery.isFetching}
                data-testid="button-find-nearby"
                className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-xs font-bold text-accent-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 sm:col-span-1"
              >
                {nearbyQuery.isFetching ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                Find nearby places
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1.16fr_.84fr]">
          <div className="order-1 min-w-0 p-3 sm:p-4 lg:p-5">
            <div className="location-map relative h-[390px] overflow-hidden rounded-2xl border border-border bg-[#d8e3df] sm:h-[500px]">
              <MapContainer
                center={PAKISTAN_CENTER}
                zoom={5}
                scrollWheelZoom
                className="h-full w-full"
                zoomControl
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <RecenterMap location={selectedLocation} />
                {icons && selectedLocation && (
                  <Marker
                    position={[
                      selectedLocation.latitude,
                      selectedLocation.longitude,
                    ]}
                    icon={icons.selected}
                  >
                    <Popup>
                      <strong>{selectedLocation.displayName}</strong>
                      <br />
                      Selected search point
                    </Popup>
                  </Marker>
                )}
                {icons && userLocation && (
                  <Marker
                    position={[userLocation.latitude, userLocation.longitude]}
                    icon={icons.user}
                  >
                    <Popup>
                      <strong>Your browser location</strong>
                    </Popup>
                  </Marker>
                )}
                {icons &&
                  places.map((place) => (
                    <Marker
                      key={place.id}
                      position={[place.latitude, place.longitude]}
                      icon={icons.place}
                      eventHandlers={{ click: () => setSelectedPlace(place) }}
                    >
                      <Popup>
                        <strong>{place.name}</strong>
                        <br />
                        {place.category}
                      </Popup>
                    </Marker>
                  ))}
              </MapContainer>
              {!selectedLocation && (
                <div
                  className="pointer-events-none absolute inset-x-4 bottom-4 z-[500] rounded-xl border border-border bg-background/90 p-3 text-center text-xs font-semibold shadow-lg backdrop-blur-sm"
                  data-testid="status-map-awaiting-location"
                >
                  Search for a place or allow browser location to begin.
                </div>
              )}
              {geocodeQuery.isFetching && (
                <div
                  className="pointer-events-none absolute inset-0 z-[500] grid place-items-center bg-primary/10 backdrop-blur-[1px]"
                  data-testid="status-geocoding"
                >
                  <div className="flex items-center gap-2 rounded-full bg-background px-4 py-2 text-xs font-bold shadow-lg">
                    <LoaderCircle className="size-4 animate-spin text-accent" />
                    Placing your search...
                  </div>
                </div>
              )}
              <div className="pointer-events-none absolute bottom-2 left-2 z-[500] rounded bg-background/90 px-2 py-1 text-[9px] text-muted-foreground shadow-sm">
                Map data © OpenStreetMap contributors
              </div>
            </div>
            {selectedPlace && (
              <div className="mt-3 lg:hidden">
                <PlaceDetail
                  place={selectedPlace}
                  onClose={() => setSelectedPlace(null)}
                />
              </div>
            )}
          </div>

          <div className="order-2 min-w-0 border-t border-border bg-card/45 p-3 sm:p-4 lg:border-l lg:border-t-0 lg:p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono-ui text-[9px] font-bold uppercase tracking-[0.16em] text-accent">
                  Results
                </p>
                <h3 className="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">
                  Places to check
                </h3>
              </div>
              {nearbyRequest && !nearbyQuery.isFetching && (
                <span
                  className="font-mono-ui text-[10px] uppercase tracking-[0.1em] text-muted-foreground"
                  data-testid="text-nearby-result-count"
                >
                  {places.length} found
                </span>
              )}
            </div>

            {nearbyQuery.isFetching && nearbyRequest ? (
              <div className="mt-5 space-y-3" data-testid="status-nearby-loading">
                <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <LoaderCircle className="size-4 animate-spin text-accent" />
                  Finding construction services near you...
                </p>
                {[0, 1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-[106px] animate-pulse rounded-xl border border-border bg-muted/60"
                  />
                ))}
              </div>
            ) : nearbyQuery.isError && nearbyRequest ? (
              <div
                className="mt-5 rounded-xl border border-accent/30 bg-accent/10 p-5"
                data-testid="status-nearby-error"
              >
                <AlertCircle className="size-5 text-accent" />
                <p className="mt-3 font-semibold">The nearby list needs another try.</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                   {apiErrorMessage(
                     nearbyError,
                     "Location services are temporarily unavailable. Please try again.",
                   )}
                </p>
                <button
                  type="button"
                  onClick={() => nearbyQuery.refetch()}
                  data-testid="button-retry-nearby"
                  className="mt-4 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                >
                  Retry nearby search
                </button>
              </div>
            ) : !nearbyRequest ? (
              <div
                className="mt-5 rounded-xl border border-dashed border-border bg-background p-6"
                data-testid="status-nearby-awaiting-search"
              >
                <div className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
                  <Navigation className="size-5" />
                </div>
                <p className="mt-5 font-semibold">Your shortlist starts here.</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Choose a location, tune the category if needed, then run one
                  nearby search. Moving the map will not trigger a search.
                </p>
              </div>
            ) : places.length === 0 ? (
              <div
                className="mt-5 rounded-xl border border-dashed border-border bg-background p-6"
                data-testid="status-nearby-empty"
              >
                <MapPin className="size-5 text-accent" />
                <p className="mt-4 font-semibold">
                  No construction services were found nearby. Try searching another
                  area.
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Try searching another area or widening the radius. OpenStreetMap
                  listings can be thin in some areas.
                </p>
              </div>
            ) : (
              <div
                className="mt-5 max-h-[520px] space-y-3 overflow-y-auto pr-1"
                data-testid="list-nearby-places"
              >
                {places.map((place) => (
                  <PlaceCard
                    key={place.id}
                    place={place}
                    active={selectedPlace?.id === place.id}
                    onSelect={() => setSelectedPlace(place)}
                  />
                ))}
              </div>
            )}

            {sourceNotice && (
              <p
                className="mt-5 border-t border-border pt-4 text-[11px] leading-5 text-muted-foreground"
                data-testid="text-osm-source-notice"
              >
                {sourceNotice}
              </p>
            )}
          </div>
        </div>

        {selectedPlace && (
          <div className="hidden border-t border-border bg-background p-5 lg:block">
            <PlaceDetail
              place={selectedPlace}
              onClose={() => setSelectedPlace(null)}
            />
          </div>
        )}
      </div>
    </section>
  );
}