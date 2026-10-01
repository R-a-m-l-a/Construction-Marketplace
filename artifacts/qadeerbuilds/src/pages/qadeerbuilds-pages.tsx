import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/react";
import { Link, useLocation, useSearch } from "wouter";
import { AlertCircle, ArrowDownRight, ArrowRight, Briefcase, Calculator, Check, ChevronDown, CircleHelp, Compass, LoaderCircle, MapPin, MessageSquareText, Save, Search, ShieldCheck, Sparkles, Store, Users } from "lucide-react";
import { getGetMyProfessionalQueryKey, getListConstructionEstimatesQueryKey, getListProjectBriefsQueryKey, useCreateConstructionEstimate, useCreateProfessional, useCreateProjectBrief, useGetDiscoveryStats, useGetMyProfessional, useListCategories, useListConstructionEstimates, useListFeaturedProfessionals, useListFeaturedProducts, useListProducts, useListProjectBriefs, useListPublicProfessionals, useUpdateMyProfessional } from "@workspace/api-client-react";
import type { ConstructionEstimate, CreateConstructionEstimateBody, CreateProfessionalBody, CreateProjectBriefBody, Professional, ProductPreview, ProjectBrief, PublicProfessional } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProductCard } from "@/components/product-card";
import {
  isAllowedImageUrl,
  PROFESSIONAL_IMAGE_URL_MAX_LENGTH,
} from "@/lib/image-url";
import { LoadingCards, PageIntro, QueryError, SectionLabel, Shell } from "@/components/qadeerbuilds-shell";
import { LocationDiscovery } from "@/components/location-discovery";
import { ProfessionalPortfolio } from "@/components/professional-portfolio";
import { ProfessionalQuoteRequests } from "@/components/professional-quote-requests";

// Phase 6A: the hard-coded `fallbackCategories` array that duplicated the
// marketplace catalogue has been removed. `/api/categories` is now the single
// source of truth, served from the database.

const MAX_COVERED_AREA_SQ_FT = 250_000;
const finishLevels = {
  basic: { label: "Essential finish", rate: 4_200 },
  standard: { label: "Balanced finish", rate: 5_600 },
  premium: { label: "Higher finish", rate: 7_200 },
} as const;
type FinishLevel = CreateConstructionEstimateBody["quality"];
type CalculatorResult = {
  area: number;
  finishLevel: FinishLevel;
  rate: number;
  total: number;
};
type SaveMessage = { kind: "success" | "error" | "auth"; text: string };
type ProjectBriefForm = {
  name: string;
  city: string;
  type: string;
  budget: string;
  timeline: string;
  details: string;
};
const projectTypeOptions: CreateProjectBriefBody["projectType"][] = [
  "New home",
  "Renovation",
  "Commercial space",
  "Something else",
];
const projectBudgetOptions: CreateProjectBriefBody["budget"][] = [
  "Under PKR 5M",
  "PKR 5M - 15M",
  "PKR 15M - 30M",
  "PKR 30M or more",
  "Not sure yet",
];
const projectTimelineOptions: CreateProjectBriefBody["timeline"][] = [
  "As soon as possible",
  "Within 1-3 months",
  "Within 3-6 months",
  "Within 6-12 months",
  "Just planning",
];
const PROFESSIONAL_LOGO_URL_MAX_LENGTH = PROFESSIONAL_IMAGE_URL_MAX_LENGTH;
type ProfessionalProfileForm = {
  name: string;
  profession: string;
  category: string;
  services: string;
  bio: string;
  city: string;
  location: string;
  logoUrl: string;
  phone: string;
  whatsapp: string;
};
type ProfessionalProfileMessage = { kind: "success" | "error"; text: string };
const emptyProfessionalProfileForm: ProfessionalProfileForm = {
  name: "",
  profession: "",
  category: "",
  services: "",
  bio: "",
  city: "",
  location: "",
  logoUrl: "",
  phone: "",
  whatsapp: "",
};
const pkrFormatter = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});
const estimateDateFormatter = new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" });
const projectBriefDateFormatter = new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" });

function formatPkr(value: number) {
  return pkrFormatter.format(value);
}

function formatPkrRange(min: number, max: number) {
  return min === max ? formatPkr(min) : `${formatPkr(min)} – ${formatPkr(max)}`;
}

function formatEstimateDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Saved estimate" : estimateDateFormatter.format(date);
}

function estimateErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
      return data.error;
    }
  }
  return "We could not save this estimate. Please try again.";
}

function projectBriefErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
      return data.error;
    }
  }
  return "We could not save this project brief. Please try again.";
}

function formatProjectBriefDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Saved project brief" : projectBriefDateFormatter.format(date);
}

function professionalFormFromProfile(professional: Professional): ProfessionalProfileForm {
  return {
    name: professional.name ?? "",
    profession: professional.profession ?? "",
    category: professional.category ?? "",
    services: professional.services ?? "",
    bio: professional.bio ?? "",
    city: professional.city ?? "",
    location: professional.location ?? "",
    logoUrl: professional.logoUrl ?? "",
    phone: professional.phone ?? "",
    whatsapp: professional.whatsapp ?? "",
  };
}

function professionalInitials(name: string, profession: string) {
  const source = name.trim() || profession.trim();
  if (!source) return "P";
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Instant client-side mirror of the shared server rule in
 * `lib/api-zod/src/shared/logo-url.ts` (isAllowedLogoUrl). The browser bundle
 * cannot import the server validation package, so this exists purely to give
 * fast feedback; the authoritative check is the shared validator, which the
 * API applies to CreateProfessionalBody and UpdateMyProfessionalBody.
 */
const isAllowedLogoUrl = isAllowedImageUrl;

function professionalRequestError(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
      return data.error;
    }
  }
  return fallback;
}

function isMissingProfileError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 404
  );
}

function createEstimateBody(result: CalculatorResult): CreateConstructionEstimateBody {
  return {
    location: "Pakistan",
    plotSize: result.area,
    plotUnit: "squareFeet",
    plotAreaSqFt: result.area,
    coveredAreaMode: "squareFeet",
    coveredAreaBasis: "total",
    coveredAreaValue: result.area,
    floorCount: 1,
    floors: "Ground floor",
    constructionType: "complete",
    quality: result.finishLevel,
    totalCoveredAreaSqFt: result.area,
    greyMin: 0,
    greyMax: 0,
    finishingMin: result.total,
    finishingMax: result.total,
    estimatedMin: result.total,
    estimatedMax: result.total,
    costPerSqFtMin: result.rate,
    costPerSqFtMax: result.rate,
  };
}

function Home() {
  const [, setLocation] = useLocation();
  const categoriesQuery = useListCategories();
  const prosQuery = useListFeaturedProfessionals();
  const productsQuery = useListFeaturedProducts();
  const statsQuery = useGetDiscoveryStats();
  // Categories now come from the database-backed endpoint. There is no
  // hard-coded fallback, so the section simply stays empty if the API fails
  // rather than showing a second, competing category list.
  const categories = categoriesQuery.data ?? [];
  const pros = prosQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const stats = statsQuery.data;
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("materials");
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const destination = kind === "professionals" ? "/professionals" : "/marketplace";
    setLocation(`${destination}${search.trim() ? `?query=${encodeURIComponent(search.trim())}` : ""}`);
  };

  return <Shell>
    <section className="paper-grid relative overflow-hidden border-b border-border bg-[#ece9df]">
      <div className="absolute -right-16 top-12 size-64 rounded-full border-[30px] border-secondary/25 sm:right-16 sm:size-80" />
      <div className="absolute right-8 top-24 hidden size-44 rotate-12 border border-primary/15 sm:block" />
      <div className="mx-auto grid max-w-[1240px] gap-12 px-5 pb-16 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:gap-20 lg:pb-24">
        <div className="relative z-10 rise-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/70 px-3 py-1.5 font-mono-ui text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"><span className="size-1.5 rounded-full bg-accent" /> Building in Pakistan, made clearer</div>
          <h1 className="mt-6 max-w-2xl font-display text-[clamp(3.4rem,9vw,7.2rem)] font-bold leading-[.88] tracking-[-0.075em] text-primary">Start with a<br /><span className="text-accent">better brief.</span></h1>
          <p className="mt-7 max-w-lg text-lg leading-7 text-primary/70 sm:text-xl">The practical place to find materials, meet reliable professionals, and take the next right step on your build.</p>
          <form onSubmit={submitSearch} className="mt-8 max-w-2xl rounded-2xl border border-primary/15 bg-background p-2 shadow-[0_16px_40px_-24px_hsl(var(--primary)/.5)]" data-testid="form-home-search">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex min-h-12 flex-1 items-center">
                <Search className="ml-3 size-5 text-muted-foreground" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="What are you building?" data-testid="input-home-search" className="h-12 w-full bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground" />
              </div>
              <label className="sr-only" htmlFor="home-search-kind">Search type</label>
              <select id="home-search-kind" value={kind} onChange={(event) => setKind(event.target.value)} data-testid="select-home-search-kind" className="h-12 rounded-xl border border-border bg-muted px-3 text-sm font-semibold outline-none">
                <option value="materials">Materials</option><option value="professionals">Professionals</option>
              </select>
              <button type="submit" data-testid="button-home-search" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5">Search <ArrowRight className="size-4" /></button>
            </div>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-muted-foreground"><span>Try:</span><button type="button" onClick={() => { setSearch("tiles"); setKind("materials"); }} data-testid="button-try-tiles" className="underline decoration-secondary decoration-2 underline-offset-4 hover:text-primary">tiles in Lahore</button><button type="button" onClick={() => { setSearch("architect"); setKind("professionals"); }} data-testid="button-try-architect" className="underline decoration-secondary decoration-2 underline-offset-4 hover:text-primary">an architect in Islamabad</button></div>
        </div>
        <div className="relative hidden min-h-[410px] lg:block rise-in-delay">
          <div className="absolute left-12 top-4 h-72 w-72 rotate-[-7deg] border-2 border-primary/20" />
          <div className="absolute left-24 top-16 h-72 w-72 rotate-[8deg] bg-primary p-5 text-primary-foreground shadow-2xl">
            <div className="flex items-center justify-between"><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-secondary">Field note / 01</span><ArrowDownRight className="size-5 text-secondary" /></div>
            <div className="mt-28"><p className="font-display text-4xl font-bold leading-none tracking-[-.06em]">Good builds<br />start local.</p><p className="mt-4 max-w-[170px] text-xs leading-5 text-primary-foreground/60">Compare the people and products around you before the first site visit.</p></div>
            <div className="absolute bottom-5 left-5 right-5 border-t border-primary-foreground/15 pt-3 font-mono-ui text-[9px] uppercase tracking-[.15em] text-primary-foreground/45">Lahore · Karachi · Islamabad</div>
          </div>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8 md:py-24">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><SectionLabel>What you can do here</SectionLabel><h2 className="mt-3 max-w-xl font-display text-4xl font-bold leading-[.98] tracking-[-.06em] sm:text-5xl">One desk.<br />Fewer loose ends.</h2></div><p className="max-w-sm text-sm leading-6 text-muted-foreground">Construction is a lot of small decisions. QadeerBuilds gives each one a sensible starting point.</p></div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <Link href="/marketplace" data-testid="card-action-marketplace" className="group rounded-2xl bg-primary p-6 text-primary-foreground transition-transform hover:-translate-y-1 sm:p-8"><Store className="size-7 text-secondary" /><h3 className="mt-16 font-display text-3xl font-bold tracking-[-.05em]">Find materials</h3><p className="mt-3 text-sm leading-6 text-primary-foreground/65">See what suppliers and shops are worth a call, starting with a short list.</p><span className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-secondary">Browse marketplace <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span></Link>
        <Link href="/professionals" data-testid="card-action-professionals" className="group rounded-2xl border border-border bg-card p-6 transition-transform hover:-translate-y-1 sm:p-8"><Users className="size-7 text-accent" /><h3 className="mt-16 font-display text-3xl font-bold tracking-[-.05em]">Meet the right people</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">Browse local architects, contractors and specialists with useful context.</p><span className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-foreground">Explore professionals <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span></Link>
        <Link href="/projects" data-testid="card-action-projects" className="group rounded-2xl border border-border bg-[#dfe9e5] p-6 transition-transform hover:-translate-y-1 sm:p-8"><MessageSquareText className="size-7 text-primary" /><h3 className="mt-16 font-display text-3xl font-bold tracking-[-.05em]">Put out a brief</h3><p className="mt-3 text-sm leading-6 text-primary/65">Describe what you need and get your project thinking in one place.</p><span className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-primary">Start a project brief <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span></Link>
      </div>
    </section>

    <section className="border-y border-border bg-card"><div className="mx-auto grid max-w-[1240px] gap-8 px-5 py-12 sm:px-8 md:grid-cols-[.85fr_1.15fr] md:items-center md:py-16"><div><SectionLabel>Early view</SectionLabel><h2 className="mt-3 font-display text-3xl font-bold leading-tight tracking-[-.05em]">A small, useful start.<br />Growing with the work.</h2><p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">We are building this with local context in mind, not a one-size-fits-all directory.</p></div><div className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-background"><Stat value={stats?.marketplaceItems} label="material leads" /><Stat value={stats?.professionalCategories} label="trade categories" /><Stat value={stats?.citiesCovered} label="cities covered" /></div></div></section>

    <section className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8 md:py-24" data-testid="section-home-materials"><div className="flex items-end justify-between gap-4"><div><SectionLabel>From the desk</SectionLabel><h2 className="mt-3 font-display text-4xl font-bold tracking-[-.06em] sm:text-5xl">A few places to begin</h2></div><Link href="/marketplace" data-testid="link-home-see-all-products" className="hidden items-center gap-2 text-sm font-bold sm:inline-flex">See all materials <ArrowRight className="size-4" /></Link></div>{productsQuery.isLoading ? <div className="mt-8"><LoadingCards count={3} /></div> : productsQuery.isError ? <div className="mt-8"><QueryError onRetry={() => productsQuery.refetch()} /></div> : products.length === 0 ? <div className="mt-8"><EmptyState label="No materials are listed yet. When a supplier publishes one it appears here." href="/marketplace" /></div> : <div className="mt-8 grid gap-4 md:grid-cols-3">{products.slice(0, 3).map((product) => <ProductCard key={product.id} product={product} />)}</div>}</section>

    {/* Phase 6D: real professionals only. The featured endpoint is
        database-backed and returns an empty list when nobody has signed up, so
        this shows an honest empty state rather than demo listings. */}
    <section className="border-t border-border bg-card" data-testid="section-home-professionals"><div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8 md:py-20"><div className="flex items-end justify-between gap-4"><div><SectionLabel>Real profiles</SectionLabel><h2 className="mt-3 font-display text-4xl font-bold tracking-[-.06em] sm:text-5xl">Recently on the network</h2></div><Link href="/professionals" data-testid="link-home-see-all-professionals" className="hidden items-center gap-2 text-sm font-bold sm:inline-flex">See all professionals <ArrowRight className="size-4" /></Link></div>{prosQuery.isLoading ? <div className="mt-8"><LoadingCards count={3} /></div> : prosQuery.isError ? <div className="mt-8"><QueryError onRetry={() => prosQuery.refetch()} /></div> : pros.length === 0 ? <div className="mt-8"><EmptyState label="No professional profiles have been published yet. Be the first to add yours." href="/professionals" /></div> : <div className="mt-8 grid gap-4 md:grid-cols-3">{pros.slice(0, 3).map((professional) => <ProfessionalCard key={professional.id} professional={professional} />)}</div>}</div></section>

    <section className="bg-secondary"><div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 py-12 sm:px-8 md:flex-row md:items-center md:justify-between md:py-14"><div><p className="font-mono-ui text-[10px] font-bold uppercase tracking-[.18em] text-primary/60">Not sure where to start?</p><h2 className="mt-2 max-w-xl font-display text-3xl font-bold leading-tight tracking-[-.05em] text-primary sm:text-4xl">Bring us the messy version.</h2></div><Link href="/assistant" data-testid="link-home-assistant" className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5">Open the assistant preview <ArrowRight className="size-4" /></Link></div></section>
  </Shell>;
}

/**
 * Phase 6D: a discovery statistic with no hard-coded fallback.
 *
 * These used to render invented numbers ("24", "8", "3") whenever the stats
 * request failed, which is exactly the kind of fake figure this project is
 * removing. An em dash now stands in while the real count is unknown, so a
 * failed request reads as "not available" rather than as a plausible-looking
 * total.
 */
function Stat({ value, label }: { value?: number; label: string }) {
  return <div className="px-3 py-5 text-center sm:px-6"><p className="font-display text-3xl font-bold tracking-[-.06em] text-primary sm:text-4xl">{value ?? "—"}</p><p className="mt-1 font-mono-ui text-[9px] uppercase leading-4 tracking-[.1em] text-muted-foreground">{label}</p></div>;
}

function EmptyState({ label, href }: { label: string; href: string }) { return <div className="col-span-full rounded-2xl border border-dashed border-border bg-card p-10 text-center"><p className="font-semibold">{label}</p><Link href={href} data-testid="link-empty-state" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-accent">Explore the directory <ArrowRight className="size-4" /></Link></div>; }

function Marketplace() {
  const search = useSearch();
  const [, setLocation] = useLocation();

  // Discovery state lives in the URL, matching the Phase 5B professional
  // listing, so a refresh and back/forward both preserve the result set.
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const term = params.get("query") ?? "";
  const category = params.get("category") ?? "";
  const city = params.get("city") ?? "";
  const supplier = params.get("supplier") ?? "";
  const hasFilters = Boolean(term || category || city || supplier);

  const productsQuery = useListProducts({
    query: term || undefined,
    category: category || undefined,
    city: city || undefined,
    supplier: supplier || undefined,
  });
  const products = productsQuery.data ?? [];

  // The category filter comes from the real categories endpoint, not from the
  // products currently on screen.
  const categoryQuery = useListCategories();
  const categories = categoryQuery.data ?? [];

  const applyFilter = (param: string, value: string) => {
    const next = new URLSearchParams(search);
    const trimmed = value.trim();
    if (trimmed) next.set(param, trimmed);
    else next.delete(param);
    const nextSearch = next.toString();
    setLocation(`/marketplace${nextSearch ? `?${nextSearch}` : ""}`, { replace: true });
  };
  const clearFilters = () => setLocation("/marketplace", { replace: true });

  // Phase 6D: a place chosen on the map writes into the existing `city` URL
  // parameter, which is the same state the city box above already edits. No
  // second filter, no coordinates, no radius, no distance sorting: products
  // are still matched by their own stored city string.
  //
  // The geocoder returns a full display name such as "Gulberg, Lahore,
  // Pakistan". The first segment is the place the person actually searched for
  // and the one a supplier would type into the city box, so that is what is
  // used. The box stays editable, so an area name that matches nothing can be
  // corrected by hand rather than being silently reinterpreted.
  const applyLocationToCity = (displayName: string) => {
    const place = displayName.split(",")[0]?.trim() ?? "";
    if (place) applyFilter("city", place);
  };

  return <Shell><PageIntro eyebrow="Marketplace / material desk" title="Know what is nearby before you buy." body="Search real listings from suppliers. Every entry here comes from a published material record, so what you see is what a supplier has actually listed." /><LocationDiscovery onLocationChange={applyLocationToCity} /><section className="mx-auto max-w-[1240px] px-5 pb-20 sm:px-8"><div className="mb-6 rounded-2xl border border-border bg-card p-4"><div className="flex items-center rounded-xl border border-border bg-background px-3"><Search className="ml-1 size-4 shrink-0 text-muted-foreground" /><input value={term} onChange={(event) => applyFilter("query", event.target.value)} placeholder="Search products, suppliers, categories or cities" data-testid="input-marketplace-search" className="h-11 w-full bg-transparent px-3 text-sm outline-none" /></div><div className="mt-3 grid gap-3 sm:grid-cols-3"><div><label htmlFor="marketplace-category" className="font-mono-ui text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Category</label><select id="marketplace-category" value={category} onChange={(event) => applyFilter("category", event.target.value)} disabled={categoryQuery.isLoading} data-testid="select-marketplace-category" className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-secondary"><option value="all">All material types</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div><label htmlFor="marketplace-city" className="font-mono-ui text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">City</label><input id="marketplace-city" value={city} onChange={(event) => applyFilter("city", event.target.value)} placeholder="e.g. Lahore" data-testid="input-marketplace-city" className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-secondary" /></div><div><label htmlFor="marketplace-supplier" className="font-mono-ui text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Supplier</label><input id="marketplace-supplier" value={supplier} onChange={(event) => applyFilter("supplier", event.target.value)} placeholder="Supplier id" data-testid="input-marketplace-supplier" className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-secondary" /></div></div>{hasFilters ? <button type="button" onClick={clearFilters} data-testid="button-clear-marketplace-filters" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-accent">Clear all filters <ArrowRight className="size-4" /></button> : null}</div>{productsQuery.isLoading ? <LoadingCards count={6} /> : productsQuery.isError ? <QueryError onRetry={() => productsQuery.refetch()} /> : products.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center" data-testid="empty-marketplace"><p className="font-semibold">{hasFilters ? "No material listings match that search." : "No material listings are published yet."}</p><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{hasFilters ? "Try a broader city, category or supplier." : "Suppliers have not published materials here yet. Check back soon."}</p>{hasFilters ? <button type="button" onClick={clearFilters} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Clear all filters <ArrowRight className="size-4" /></button> : null}</div>}<p className="mt-8 text-center font-mono-ui text-[10px] uppercase tracking-[.14em] text-muted-foreground">{productsQuery.isLoading ? "Loading listings…" : `${products.length} ${products.length === 1 ? "listing" : "listings"}`}</p></section></Shell>;
}

/**
 * Accepts the narrowest shape both the discovery list and the featured
 * preview satisfy, so the same card renders a full public listing and a
 * homepage preview without either endpoint having to invent fields.
 */
function ProfessionalCard({ professional }: { professional: Pick<PublicProfessional, "id" | "name" | "profession" | "category" | "services" | "city" | "location" | "logoUrl"> }) {
  return <article data-testid={`card-professional-${professional.id}`} className="rounded-2xl border border-border bg-card p-6 transition-transform hover:-translate-y-1"><div className="flex items-start justify-between gap-3"><Avatar className="size-12 rounded-xl">{professional.logoUrl ? <AvatarImage src={professional.logoUrl} alt={professional.name} className="rounded-xl" /> : null}<AvatarFallback className="rounded-xl font-display text-lg font-bold text-secondary">{professionalInitials(professional.name, professional.profession)}</AvatarFallback></Avatar></div><h3 className="mt-5 font-display text-2xl font-bold tracking-[-.04em]">{professional.name}</h3><p className="mt-1 text-sm font-semibold text-accent">{professional.profession}</p><p className="mt-1 font-mono-ui text-[10px] uppercase tracking-[.14em] text-muted-foreground">{professional.category}</p><p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">{professional.services}</p><div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-4 text-xs font-medium text-muted-foreground"><span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{professional.city}</span>{professional.location ? <span className="inline-flex items-center gap-1"><Compass className="size-3.5" />{professional.location}</span> : null}</div><Link href={`/professionals/${professional.id}`} data-testid={`link-view-professional-${professional.id}`} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">View profile and work <ArrowRight className="size-4" /></Link></article>;
}

const PROFESSIONAL_FILTERS = [
  { param: "city", label: "City", placeholder: "e.g. Peshawar", testId: "input-professional-filter-city" },
  { param: "location", label: "Area", placeholder: "e.g. DHA Phase 5", testId: "input-professional-filter-location" },
  { param: "category", label: "Category", placeholder: "e.g. Interior design", testId: "input-professional-filter-category" },
  { param: "services", label: "Service", placeholder: "e.g. grey structure", testId: "input-professional-filter-services" },
] as const;

function Professionals() {
  const search = useSearch();
  const [, setLocation] = useLocation();

  // Discovery state lives in the URL so a refresh keeps the same results, and
  // the homepage search already links here with ?query=
  const filters = useMemo(() => new URLSearchParams(search), [search]);
  const term = filters.get("query") ?? "";
  const city = filters.get("city") ?? "";
  const area = filters.get("location") ?? "";
  const category = filters.get("category") ?? "";
  const services = filters.get("services") ?? "";
  const hasFilters = Boolean(term || city || area || category || services);

  const listQuery = useListPublicProfessionals({
    query: term || undefined,
    city: city || undefined,
    location: area || undefined,
    category: category || undefined,
    services: services || undefined,
  });
  const professionals = listQuery.data ?? [];

  // The free-text box must keep every character the user types. Trimming here
  // would commit "Interior" while the caret is on a trailing space, the URL
  // round-trip would drop it, and the next character would land against the
  // unspaced value, making "Interior Design" impossible to type. Server-side
  // trimming still happens before the term is used.
  const applyFilter = (param: string, value: string, preserveSpaces = false) => {
    const next = new URLSearchParams(search);
    const stored = preserveSpaces ? value : value.trim();
    if (stored) next.set(param, stored);
    else next.delete(param);
    const nextSearch = next.toString();
    setLocation(`/professionals${nextSearch ? `?${nextSearch}` : ""}`, { replace: true });
  };
  const clearFilters = () => setLocation("/professionals", { replace: true });

  return <Shell><PageIntro eyebrow="Professionals / local network" title="The people behind the good work." body="Search real professional profiles by trade, service, city or area, then read what they actually offer." /><div className="mx-auto max-w-[1240px] px-5 sm:px-8"><div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><Briefcase className="mt-0.5 size-5 shrink-0 text-accent" /><div><p className="font-semibold">Are you a professional or service provider?</p><p className="mt-1 text-sm text-muted-foreground">Create your profile so clients can find your trade, city and services.</p></div></div><Link href="/professionals/me" data-testid="link-manage-professional" className="inline-flex w-fit shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Manage your profile <ArrowRight className="size-4" /></Link></div></div><LocationDiscovery /><section className="mx-auto max-w-[1240px] px-5 pb-20 sm:px-8"><div className="mb-6 rounded-2xl border border-border bg-card p-4"><div className="flex items-center rounded-xl border border-border bg-background px-3"><Search className="ml-1 size-4 shrink-0 text-muted-foreground" /><input value={term} onChange={(event) => applyFilter("query", event.target.value, true)} placeholder="Search by name, trade, service or area" data-testid="input-professionals-search" className="h-11 w-full bg-transparent px-3 text-sm outline-none" /></div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{PROFESSIONAL_FILTERS.map((filter) => <div key={filter.param}><label htmlFor={`professional-filter-${filter.param}`} className="font-mono-ui text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">{filter.label}</label><input id={`professional-filter-${filter.param}`} value={filters.get(filter.param) ?? ""} onChange={(event) => applyFilter(filter.param, event.target.value)} placeholder={filter.placeholder} data-testid={filter.testId} className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-secondary" /></div>)}</div>{hasFilters ? <button type="button" onClick={clearFilters} data-testid="button-clear-professional-filters" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-accent">Clear all filters <ArrowRight className="size-4" /></button> : null}</div>{listQuery.isLoading ? <LoadingCards count={6} /> : listQuery.isError ? <QueryError onRetry={() => listQuery.refetch()} /> : professionals.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{professionals.map((professional) => <ProfessionalCard key={professional.id} professional={professional} />)}</div> : hasFilters ? <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center" data-testid="empty-professionals-filtered"><p className="font-semibold">No professionals match that search.</p><p className="mt-2 text-sm text-muted-foreground">Try a broader city, area, category or service.</p><button type="button" onClick={clearFilters} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Clear all filters <ArrowRight className="size-4" /></button></div> : <EmptyState label="No professional profiles are live yet." href="/professionals/me" />}</section></Shell>;
}

function Projects() {
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState<ProjectBriefForm>({ name: "", city: "", type: "", budget: "", timeline: "", details: "" });
  const [saveMessage, setSaveMessage] = useState<SaveMessage | null>(null);
  const createMutation = useCreateProjectBrief({
    mutation: {
      onSuccess: async () => {
        setSent(true);
        setSaveMessage(null);
        await queryClient.invalidateQueries({ queryKey: getListProjectBriefsQueryKey() });
      },
      onError: (error) => setSaveMessage({ kind: "error", text: projectBriefErrorMessage(error) }),
    },
  });
  const update = (field: keyof ProjectBriefForm) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setSaveMessage(null);
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };
  const submitProjectBrief = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createMutation.isPending || sent) return;
    if (!isSignedIn) {
      setSaveMessage({ kind: "auth", text: "Sign in to save this project brief." });
      return;
    }
    createMutation.mutate({
      data: {
        name: form.name.trim(),
        projectType: form.type as CreateProjectBriefBody["projectType"],
        location: form.city.trim(),
        budget: form.budget as CreateProjectBriefBody["budget"],
        timeline: form.timeline as CreateProjectBriefBody["timeline"],
        description: form.details.trim(),
      },
    });
  };
  return <Shell><div className="mx-auto grid max-w-[1240px] gap-12 px-5 pb-20 pt-12 sm:px-8 md:grid-cols-[.8fr_1.2fr] md:items-start md:gap-20 md:pt-20"><div><SectionLabel>Project brief</SectionLabel><h1 className="mt-4 font-display text-5xl font-bold leading-[.94] tracking-[-.065em] sm:text-7xl">Put the<br /><span className="text-accent">messy bit</span><br />somewhere.</h1><p className="mt-6 max-w-sm text-base leading-7 text-muted-foreground">This is your private starting note. Tell us what you know, what you do not, and where the work is happening.</p><div className="mt-10 space-y-4 text-sm text-muted-foreground"><p className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0 text-accent" />No perfect brief required.</p><p className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0 text-accent" />We will keep the next step visible.</p><p className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0 text-accent" />You can browse first, decide later.</p></div></div><div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">{sent ? <div className="flex min-h-[430px] flex-col items-center justify-center text-center"><div className="grid size-16 place-items-center rounded-2xl bg-secondary text-primary"><Check className="size-8" /></div><h2 className="mt-6 font-display text-3xl font-bold tracking-[-.05em]">Your project brief is saved.</h2><p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">It is now available in your planning desk and will stay there after you sign in again.</p><Link href="/dashboard" data-testid="link-project-success-dashboard" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">View your planning desk <ArrowRight className="size-4" /></Link></div> : <form onSubmit={submitProjectBrief} className="space-y-5" data-testid="form-project-brief"><div><label htmlFor="project-name" className="text-sm font-bold">Your name</label><input required maxLength={120} id="project-name" value={form.name} onChange={update("name")} data-testid="input-project-name" className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-secondary" placeholder="What should we call you?" /></div><div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="project-city" className="text-sm font-bold">Build city</label><input required maxLength={120} id="project-city" value={form.city} onChange={update("city")} data-testid="input-project-city" className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-secondary" placeholder="Lahore, Karachi…" /></div><div><label htmlFor="project-type" className="text-sm font-bold">What are you planning?</label><select required id="project-type" value={form.type} onChange={update("type")} data-testid="select-project-type" className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-secondary"><option value="">Choose one</option>{projectTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div></div><div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="project-budget" className="text-sm font-bold">Planned budget</label><select required id="project-budget" value={form.budget} onChange={update("budget")} data-testid="select-project-budget" className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-secondary"><option value="">Choose a range</option>{projectBudgetOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div><div><label htmlFor="project-timeline" className="text-sm font-bold">Ideal timeline</label><select required id="project-timeline" value={form.timeline} onChange={update("timeline")} data-testid="select-project-timeline" className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-secondary"><option value="">Choose a timeline</option>{projectTimelineOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div></div><div><label htmlFor="project-details" className="text-sm font-bold">The rough version</label><textarea required maxLength={5000} id="project-details" value={form.details} onChange={update("details")} data-testid="textarea-project-details" className="mt-2 min-h-36 w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-secondary" placeholder="What do you need help deciding?" /></div><button type="submit" disabled={!isLoaded || createMutation.isPending} aria-busy={createMutation.isPending} data-testid="button-submit-project" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">{createMutation.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{createMutation.isPending ? "Saving project brief..." : "Save my project brief"}</button>{saveMessage && <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 text-sm" aria-live="polite" data-testid={`status-project-${saveMessage.kind}`}><p>{saveMessage.text}</p>{saveMessage.kind === "auth" && <Link href="/sign-in" className="mt-2 inline-flex items-center gap-2 font-bold text-accent">Sign in <ArrowRight className="size-4" /></Link>}</div>}<p className="text-center font-mono-ui text-[9px] uppercase tracking-[.12em] text-muted-foreground">Private to your QadeerBuilds account</p></form>}</div></div></Shell>;
}

function Assistant() {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState(false);
  return <Shell><section className="mx-auto max-w-[1000px] px-5 py-12 sm:px-8 md:py-20"><div className="mx-auto max-w-2xl text-center"><div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary text-secondary"><Sparkles className="size-7" /></div><SectionLabel>Next phase / assistant</SectionLabel><h1 className="mt-4 font-display text-5xl font-bold leading-[.95] tracking-[-.07em] sm:text-7xl">Ask the question<br /><span className="text-accent">you are avoiding.</span></h1><p className="mt-6 text-base leading-7 text-muted-foreground">A construction guide that will help you make sense of quotes, materials and the order of things. We are still teaching it the local detail.</p></div><div className="mx-auto mt-12 max-w-2xl rounded-2xl border border-border bg-card p-4 sm:p-6"><div className="flex items-center gap-3 border-b border-border pb-4"><CircleHelp className="size-5 text-accent" /><span className="text-sm font-bold">What would you like to understand?</span></div><form onSubmit={(event) => { event.preventDefault(); setAsked(true); }} className="mt-4" data-testid="form-assistant-question"><textarea required value={question} onChange={(event) => setQuestion(event.target.value)} data-testid="textarea-assistant-question" className="min-h-32 w-full resize-none bg-transparent text-base leading-7 outline-none placeholder:text-muted-foreground" placeholder="For example: what should I ask a contractor before comparing quotes?" /><div className="mt-4 flex flex-col items-start justify-between gap-4 border-t border-border pt-4 sm:flex-row sm:items-center"><p className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-muted-foreground">Preview mode · replies arrive next phase</p><button type="submit" data-testid="button-ask-assistant" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">Send question <ArrowRight className="size-4" /></button></div></form>{asked && <div className="mt-5 rounded-xl bg-muted p-4 text-sm leading-6 text-muted-foreground" data-testid="text-assistant-response">Good question. QadeerBuilds will be able to break that into a practical checklist in the next phase. For now, try writing down the quote, the scope, and what is not included.</div>}</div></section></Shell>;
}

function CalculatorPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const [area, setArea] = useState("");
  const [type, setType] = useState<FinishLevel>("standard");
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const [formError, setFormError] = useState("");
  const [saveMessage, setSaveMessage] = useState<SaveMessage | null>(null);
  const createMutation = useCreateConstructionEstimate({
    mutation: {
      onSuccess: async () => {
        setSaveMessage({ kind: "success", text: "Estimate saved to your planning desk." });
        await queryClient.invalidateQueries({ queryKey: getListConstructionEstimatesQueryKey() });
      },
      onError: (error) => setSaveMessage({ kind: "error", text: estimateErrorMessage(error) }),
    },
  });

  const clearResult = () => {
    setResult(null);
    setFormError("");
    setSaveMessage(null);
    createMutation.reset();
  };

  const calculateEstimate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericArea = Number(area);
    if (!area.trim()) {
      setFormError("Enter the approximate covered area.");
      return;
    }
    if (!Number.isFinite(numericArea)) {
      setFormError("Enter a valid covered area.");
      return;
    }
    if (!Number.isInteger(numericArea) || numericArea < 1) {
      setFormError("Covered area must be a whole number greater than zero.");
      return;
    }
    if (numericArea > MAX_COVERED_AREA_SQ_FT) {
      setFormError("Covered area cannot exceed 250,000 sq ft.");
      return;
    }

    const rate = finishLevels[type].rate;
    setFormError("");
    setSaveMessage(null);
    setResult({ area: numericArea, finishLevel: type, rate, total: numericArea * rate });
  };

  const saveEstimate = () => {
    if (!result) return;
    if (!isSignedIn) {
      setSaveMessage({ kind: "auth", text: "Sign in to save this estimate." });
      return;
    }
    createMutation.mutate({ data: createEstimateBody(result) });
  };

  return <Shell>
    <PageIntro eyebrow="Construction / cost calculator" title="Put a first number on the napkin." body="Use covered area and finish level for a deterministic planning estimate. It is a starting point, not a contractor quote." />
    <section className="mx-auto grid max-w-[1000px] gap-8 px-5 pb-20 sm:px-8 md:grid-cols-[1fr_.8fr]">
      <form onSubmit={calculateEstimate} className="rounded-2xl border border-border bg-card p-6 sm:p-8" data-testid="form-calculator" noValidate>
        <div>
          <label htmlFor="calculator-area" className="text-sm font-bold">Approximate covered area (sq ft)</label>
          <input required min="1" max={MAX_COVERED_AREA_SQ_FT} step="1" type="number" id="calculator-area" value={area} onChange={(event) => { setArea(event.target.value); clearResult(); }} data-testid="input-calculator-area" aria-invalid={Boolean(formError)} aria-describedby={formError ? "calculator-area-error" : undefined} className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-secondary" placeholder="e.g. 1,200" />
          {formError && <p id="calculator-area-error" className="mt-2 flex gap-2 text-sm text-accent" data-testid="text-calculator-error"><AlertCircle className="mt-0.5 size-4 shrink-0" />{formError}</p>}
        </div>
        <div className="mt-5">
          <label htmlFor="calculator-finish" className="text-sm font-bold">Finish level</label>
          <select id="calculator-finish" value={type} onChange={(event) => { setType(event.target.value as FinishLevel); clearResult(); }} data-testid="select-calculator-finish" className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none">
            <option value="basic">Essential finish</option>
            <option value="standard">Balanced finish</option>
            <option value="premium">Higher finish</option>
          </select>
        </div>
        <button type="submit" data-testid="button-calculate" className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground">Show planning estimate <Calculator className="size-4" /></button>
      </form>
      <div className="rounded-2xl bg-primary p-6 text-primary-foreground sm:p-8" data-testid="calculator-result">
        <Calculator className="size-7 text-secondary" />
        {result ? <>
          <p className="mt-10 font-mono-ui text-[10px] uppercase tracking-[.16em] text-primary-foreground/55">Estimated total</p>
          <p className="mt-3 font-display text-4xl font-bold tracking-[-.06em]" data-testid="text-estimated-total">{formatPkr(result.total)}</p>
          <dl className="mt-6 space-y-3 border-t border-primary-foreground/15 pt-5 text-sm">
            <div className="flex items-center justify-between gap-4"><dt className="text-primary-foreground/60">Covered area</dt><dd className="font-bold">{result.area.toLocaleString("en-PK")} sq ft</dd></div>
            <div className="flex items-center justify-between gap-4"><dt className="text-primary-foreground/60">Finish level</dt><dd className="font-bold">{finishLevels[result.finishLevel].label}</dd></div>
            <div className="flex items-center justify-between gap-4"><dt className="text-primary-foreground/60">Rate</dt><dd className="font-bold">{formatPkr(result.rate)} / sq ft</dd></div>
          </dl>
          <button type="button" onClick={saveEstimate} disabled={!isLoaded || createMutation.isPending} data-testid="button-save-estimate" className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-secondary px-4 text-sm font-bold text-primary transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">
            {createMutation.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            {createMutation.isPending ? "Saving estimate..." : "Save Estimate"}
          </button>
          {saveMessage && <div className="mt-3 rounded-xl bg-background/10 p-3 text-sm" aria-live="polite" data-testid={`status-save-${saveMessage.kind}`}>
            <p>{saveMessage.text}</p>
            {saveMessage.kind === "auth" && <Link href="/sign-in" className="mt-2 inline-flex items-center gap-2 font-bold text-secondary">Sign in <ArrowRight className="size-4" /></Link>}
          </div>}
        </> : <>
          <p className="mt-16 font-mono-ui text-[10px] uppercase tracking-[.16em] text-primary-foreground/55">Estimated total</p>
          <p className="mt-3 font-display text-4xl font-bold tracking-[-.06em]">- - -</p>
          <p className="mt-4 text-sm leading-6 text-primary-foreground/65">Enter your area to see a deliberately rough starting point.</p>
        </>}
      </div>
    </section>
  </Shell>;
}

function About() {
  return <Shell><PageIntro eyebrow="About QadeerBuilds" title="A calmer way to begin building." body="The first decision is rarely the most expensive one. It is usually knowing who to ask, what to compare, and what comes next." /><section className="mx-auto grid max-w-[1240px] gap-12 px-5 pb-20 sm:px-8 md:grid-cols-[1.1fr_.9fr] md:gap-20"><div className="space-y-6 text-base leading-8 text-muted-foreground"><p>QadeerBuilds is a construction discovery platform for people in Pakistan who are planning a home, improving a space, or simply trying to make sense of the work ahead.</p><p>We are starting with the practical layer: materials worth exploring, professionals worth contacting, and a place to put your project brief. No inflated promises. Just clearer next steps.</p><p>Our directory begins with demo content so we can shape the experience before local listings become the centre of it. Every demo surface is marked clearly.</p></div><div className="rounded-2xl bg-primary p-7 text-primary-foreground sm:p-9"><SectionLabel>Our working rule</SectionLabel><p className="mt-8 font-display text-4xl font-bold leading-[.98] tracking-[-.06em]">Make the next decision easier than the last.</p><div className="mt-10 border-t border-primary-foreground/15 pt-5 text-sm leading-6 text-primary-foreground/65">Built for local context, careful comparisons, and the long middle between idea and handover.</div></div></section></Shell>;
}

function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  const [, setLocation] = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const isSignIn = mode === "sign-in";
  return <div className="grain flex min-h-[100dvh] bg-[#ece9df]"><div className="hidden w-[42%] flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex"><div><Link href="/" data-testid="link-auth-logo" className="inline-flex"><span className="font-display text-3xl font-bold tracking-[-.06em]">QadeerBuilds</span></Link><div className="mt-28 max-w-sm"><SectionLabel>Welcome to the desk</SectionLabel><h1 className="mt-4 font-display text-6xl font-bold leading-[.9] tracking-[-.07em]">Good builds<br /><span className="text-secondary">begin clearly.</span></h1><p className="mt-6 text-sm leading-6 text-primary-foreground/60">Save your briefs, keep your planning in one place, and return when you are ready for the next call.</p></div></div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-primary-foreground/45">Pakistan / early access</p></div><div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8"><div className="w-full max-w-[420px]"><div className="mb-10 lg:hidden"><Link href="/" data-testid="link-auth-mobile-logo" className="font-display text-3xl font-bold tracking-[-.06em]">QadeerBuilds</Link></div>{submitted ? <div className="rounded-2xl border border-border bg-card p-7 text-center sm:p-9"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-primary"><Check className="size-7" /></div><h2 className="mt-5 font-display text-3xl font-bold tracking-[-.05em]">Demo access noted.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Clerk authentication will take over this branded screen when the auth wiring is connected.</p><Link href="/" data-testid="link-auth-success-home" className="mt-6 inline-flex items-center gap-2 font-bold">Back to QadeerBuilds <ArrowRight className="size-4" /></Link></div> : <form onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }} className="rounded-2xl border border-border bg-card p-7 sm:p-9" data-testid={`form-${mode}`}><SectionLabel>{isSignIn ? "Return to your desk" : "Make a place for your plans"}</SectionLabel><h1 className="mt-4 font-display text-4xl font-bold tracking-[-.06em]">{isSignIn ? "Welcome back." : "Create your QadeerBuilds account."}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{isSignIn ? "Keep your project thinking close." : "Save your briefs and pick up where you left off."}</p><label htmlFor="auth-email" className="mt-8 block text-sm font-bold">Email address</label><input required type="email" id="auth-email" data-testid="input-auth-email" className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-secondary" placeholder="you@example.com" /><label htmlFor="auth-password" className="mt-5 block text-sm font-bold">Password</label><input required minLength={6} type="password" id="auth-password" data-testid="input-auth-password" className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-secondary" placeholder="At least 6 characters" /><button type="submit" data-testid={`button-submit-${mode}`} className="mt-6 h-12 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground">{isSignIn ? "Sign in" : "Create account"}</button><p className="mt-6 text-center text-sm text-muted-foreground">{isSignIn ? "New to QadeerBuilds?" : "Already have an account?"} <button type="button" onClick={() => setLocation(isSignIn ? "/sign-up" : "/sign-in")} data-testid="button-switch-auth" className="font-bold text-accent underline underline-offset-4">{isSignIn ? "Create one" : "Sign in"}</button></p></form>}</div></div></div>;
}

function ProfessionalProfileField({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  maxLength,
  testId,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
  testId: string;
}) {
  return <div>
    <label htmlFor={id} className="text-sm font-bold">{label}</label>
    <input required={required} type={type} maxLength={maxLength} id={id} value={value} onChange={onChange} data-testid={testId} placeholder={placeholder} className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-secondary" />
  </div>;
}

function ProfessionalProfilePage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProfessionalProfileForm>(emptyProfessionalProfileForm);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<ProfessionalProfileMessage | null>(null);

  const query = useGetMyProfessional({
    query: {
      enabled: isLoaded && isSignedIn,
      retry: false,
      queryKey: getGetMyProfessionalQueryKey(),
    },
  });
  const existing = query.data;
  const isMissingProfile = isMissingProfileError(query.error);
  const formValues = useMemo(
    () => (existing && !dirty ? professionalFormFromProfile(existing) : form),
    [existing, dirty, form],
  );

  // The profile query is only enabled once Clerk has resolved the session, so both
  // "Clerk still loading" and "query still fetching" are genuinely unknown states
  // and must render the loading skeleton. A disabled query reports isLoading ===
  // false, which previously fell through to the form and showed a misleading empty
  // editable profile while a real profile existed.
  const isProfileLoading = !isLoaded || (isSignedIn && query.isPending);

  // Seed local form state from the loaded profile. `form` was previously only
  // populated after a successful mutation, so any window where `existing` was
  // momentarily undefined (Clerk revalidation disables the query and clears
  // query.data) fell back to the still-empty `form` and blanked the page. Seeding
  // only while the user has no unsaved edits keeps background refetches from
  // clobbering in-progress typing.
  useEffect(() => {
    if (!existing || dirty) return;
    setForm(professionalFormFromProfile(existing));
  }, [existing, dirty]);

  const applyProfile = async (professional: Professional) => {
    const next = professionalFormFromProfile(professional);
    setForm(next);
    setDirty(false);
    queryClient.setQueryData(getGetMyProfessionalQueryKey(), professional);
    await queryClient.invalidateQueries({ queryKey: getGetMyProfessionalQueryKey() });
  };

  const createMutation = useCreateProfessional({
    mutation: {
      onSuccess: async (professional) => {
        setMessage({ kind: "success", text: "Professional profile created." });
        await applyProfile(professional);
      },
      onError: (error) => setMessage({ kind: "error", text: professionalRequestError(error, "We could not create your professional profile.") }),
    },
  });
  const updateMutation = useUpdateMyProfessional({
    mutation: {
      onSuccess: async (professional) => {
        setMessage({ kind: "success", text: "Professional profile updated." });
        await applyProfile(professional);
      },
      onError: (error) => setMessage({ kind: "error", text: professionalRequestError(error, "We could not update your professional profile.") }),
    },
  });
  const isPending = createMutation.isPending || updateMutation.isPending;

  const update = (field: keyof ProfessionalProfileForm) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setDirty(true);
    setMessage(null);
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const storedLogo = (existing?.logoUrl ?? "").trim();
  const typedLogo = formValues.logoUrl.trim();
  const avatarSrc = typedLogo || storedLogo || (user?.hasImage ? user.imageUrl : "") || "";
  const isUpdate = Boolean(existing);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;

    const requiredFields = [
      ["name", "Name"],
      ["profession", "Profession"],
      ["category", "Category"],
      ["services", "Services"],
      ["city", "City"],
    ] as const;
    for (const [field, label] of requiredFields) {
      if (!formValues[field].trim()) {
        setMessage({ kind: "error", text: `${label} is required.` });
        return;
      }
    }
    if (!isAllowedLogoUrl(formValues.logoUrl)) {
      setMessage({ kind: "error", text: "Logo must be an absolute http or https image URL." });
      return;
    }

    const shared = {
      name: formValues.name.trim(),
      profession: formValues.profession.trim(),
      category: formValues.category.trim(),
      services: formValues.services.trim(),
      city: formValues.city.trim(),
    };

    if (isUpdate) {
      updateMutation.mutate({
        data: {
          ...shared,
          bio: formValues.bio.trim(),
          location: formValues.location.trim(),
          phone: formValues.phone.trim(),
          whatsapp: formValues.whatsapp.trim(),
          logoUrl: formValues.logoUrl.trim(),
        },
      });
      return;
    }

    const payload: CreateProfessionalBody = {
      ...shared,
      bio: formValues.bio.trim() || undefined,
      location: formValues.location.trim() || undefined,
      phone: formValues.phone.trim() || undefined,
      whatsapp: formValues.whatsapp.trim() || undefined,
      logoUrl: formValues.logoUrl.trim() || undefined,
    };
    if (!payload.logoUrl && user?.hasImage) {
      payload.logoUrl = user.imageUrl;
    }
    createMutation.mutate({ data: payload });
  };

  return <Shell>
    <PageIntro eyebrow="Professionals / your profile" title="Put your work in front of the right client." body="Create the professional record customers will see. You can update it at any time from your planning desk." />
    <section className="mx-auto max-w-[1100px] px-5 pb-20 sm:px-8">
      {isProfileLoading ? <div className="rounded-2xl border border-border bg-card p-6"><div className="h-24 w-24 animate-pulse rounded-full bg-muted/60" /><div className="mt-6 h-12 w-full animate-pulse rounded-xl bg-muted/60" /><div className="mt-4 h-12 w-full animate-pulse rounded-xl bg-muted/60" /></div>
      : query.isError && !isMissingProfile ? <div className="rounded-2xl border border-accent/30 bg-accent/10 p-6" data-testid="status-professional-profile-error"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 size-5 shrink-0 text-accent" /><div><p className="font-semibold">Your professional profile could not be loaded.</p><p className="mt-1 text-sm text-muted-foreground">{professionalRequestError(query.error, "The professional service may be temporarily unavailable.")}</p></div></div><button type="button" onClick={() => void query.refetch()} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Try again</button></div>
      : <div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
        <div className="rounded-2xl border border-border bg-card p-6 lg:sticky lg:top-24 lg:self-start">
          <SectionLabel>Profile logo</SectionLabel>
          <div className="mt-5 flex items-center gap-4">
            <Avatar className="size-20">
              {avatarSrc ? <AvatarImage src={avatarSrc} alt={formValues.name || "Professional logo"} /> : null}
              <AvatarFallback className="text-xl font-bold">{professionalInitials(formValues.name, formValues.profession)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-display text-2xl font-bold tracking-[-0.04em]">{formValues.name || "Your professional name"}</p>
              <p className="truncate text-sm text-muted-foreground">{formValues.profession || "Your profession"}</p>
            </div>
          </div>
          <ol className="mt-6 space-y-2 border-t border-border pt-5 text-xs text-muted-foreground">
            <li className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-accent" />Logo order: your saved logo URL, then your Clerk photo, then your initials.</li>
            <li className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-accent" />Paste a public http or https image link. File uploads arrive in a later phase.</li>
            <li className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-accent" />Your profile is linked to your signed-in account only.</li>
          </ol>
        </div>

        <form onSubmit={submit} className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-8" data-testid="form-professional-profile">
          <div><SectionLabel>{isUpdate ? "Update your profile" : "Create your profile"}</SectionLabel><h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.05em]">{isUpdate ? "Keep your details current." : "Tell clients what you do."}</h2></div>
          <ProfessionalProfileField id="professional-name" label="Name" required maxLength={120} value={formValues.name} onChange={update("name")} placeholder="e.g. SM Construction" testId="input-professional-name" />
          <div className="grid gap-5 sm:grid-cols-2">
            <ProfessionalProfileField id="professional-profession" label="Profession" required maxLength={80} value={formValues.profession} onChange={update("profession")} placeholder="e.g. Contractor" testId="input-professional-profession" />
            <ProfessionalProfileField id="professional-category" label="Category" required maxLength={80} value={formValues.category} onChange={update("category")} placeholder="e.g. Grey Structure" testId="input-professional-category" />
          </div>
          <ProfessionalProfileField id="professional-services" label="Services" required maxLength={1000} value={formValues.services} onChange={update("services")} placeholder="e.g. Grey structure, finishing, site supervision" testId="input-professional-services" />
          <div>
            <label htmlFor="professional-bio" className="text-sm font-bold">Bio</label>
            <textarea id="professional-bio" maxLength={2000} value={formValues.bio} onChange={update("bio")} data-testid="textarea-professional-bio" placeholder="A short description of your work and approach" className="mt-2 min-h-28 w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-secondary" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <ProfessionalProfileField id="professional-city" label="City" required maxLength={120} value={formValues.city} onChange={update("city")} placeholder="e.g. Lahore" testId="input-professional-city" />
            <ProfessionalProfileField id="professional-location" label="Area / location" maxLength={200} value={formValues.location} onChange={update("location")} placeholder="e.g. DHA Phase 5" testId="input-professional-location" />
          </div>
          <ProfessionalProfileField id="professional-logo-url" label="Logo URL" type="url" maxLength={PROFESSIONAL_LOGO_URL_MAX_LENGTH} value={formValues.logoUrl} onChange={update("logoUrl")} placeholder="https://example.com/logo.png" testId="input-professional-logo-url" />
          <div className="grid gap-5 sm:grid-cols-2">
            <ProfessionalProfileField id="professional-phone" label="Phone" type="tel" maxLength={32} value={formValues.phone} onChange={update("phone")} placeholder="e.g. 0300 1234567" testId="input-professional-phone" />
            <ProfessionalProfileField id="professional-whatsapp" label="WhatsApp" type="tel" maxLength={32} value={formValues.whatsapp} onChange={update("whatsapp")} placeholder="e.g. 0300 1234567" testId="input-professional-whatsapp" />
          </div>
          {message && <div className={`rounded-xl border p-3 text-sm ${message.kind === "error" ? "border-accent/30 bg-accent/10" : "border-border bg-muted/40"}`} aria-live="polite" data-testid={`status-professional-${message.kind}`}>{message.text}</div>}
          <button type="submit" disabled={isPending} aria-busy={isPending} data-testid="button-save-professional" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">
            {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            {isPending ? "Saving profile..." : isUpdate ? "Update professional profile" : "Create professional profile"}
          </button>
          <p className="text-center font-mono-ui text-[9px] uppercase tracking-[.12em] text-muted-foreground">One profile per account</p>
        </form>
      </div>}
      {isUpdate ? <ProfessionalPortfolio /> : null}
      {isUpdate ? <ProfessionalQuoteRequests /> : null}
    </section>
  </Shell>;
}

function Dashboard() {
  return <Shell><div className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8 md:py-20"><SectionLabel>Your planning desk</SectionLabel><div className="mt-4 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><h1 className="font-display text-5xl font-bold tracking-[-.07em] sm:text-6xl">Good morning.</h1><p className="mt-3 text-muted-foreground">A quiet place to keep the next decision visible.</p></div><Link href="/projects" data-testid="link-dashboard-new-project" className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">New project brief <ArrowRight className="size-4" /></Link></div><div className="mt-12 grid gap-4 md:grid-cols-[1.1fr_.9fr]"><div className="rounded-2xl bg-primary p-7 text-primary-foreground sm:p-9"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-secondary">Your next step</p><h2 className="mt-5 max-w-md font-display text-4xl font-bold leading-[.98] tracking-[-.06em]">Start with what you know.</h2><p className="mt-4 max-w-sm text-sm leading-6 text-primary-foreground/60">Your saved project briefs and calculator estimates stay here so the next decision is easier to find.</p><Link href="/projects" data-testid="link-dashboard-start-brief" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-secondary">Write a rough brief <ArrowRight className="size-4" /></Link></div><div className="rounded-2xl border border-border bg-card p-7 sm:p-9"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-accent">Your workspace</p><div className="mt-7 space-y-4"><DashboardRow icon={<Briefcase />} label="Professional profile" value="Create or update your listing" href="/professionals/me" /><DashboardRow icon={<Store />} label="Saved materials" value="Browse the marketplace" href="/marketplace" /><DashboardRow icon={<MessageSquareText />} label="Supplier enquiries" value="Quote requests sent to your store" href="/marketplace/me" /><DashboardRow icon={<Users />} label="People to call" value="Explore professionals" href="/professionals" /></div></div></div><SavedProjectBriefs /><SavedEstimates /></div></Shell>;
}

function SavedProjectBriefs() {
  const query = useListProjectBriefs();
  const briefs = query.data ?? [];

  return <section className="mt-6 border-t border-border pt-10" data-testid="section-saved-project-briefs">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><SectionLabel>Saved project briefs</SectionLabel><h2 className="mt-3 font-display text-3xl font-bold tracking-[-.05em]">The work you are planning</h2></div>
      <Link href="/projects" className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">New project brief <MessageSquareText className="size-4" /></Link>
    </div>
    {query.isLoading ? <div className="mt-6 grid gap-4 md:grid-cols-2"><div className="h-56 animate-pulse rounded-2xl border border-border bg-muted/60" /><div className="h-56 animate-pulse rounded-2xl border border-border bg-muted/60" /></div> : query.isError ? <div className="mt-6 rounded-2xl border border-accent/30 bg-accent/10 p-6" data-testid="status-saved-project-briefs-error"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 size-5 shrink-0 text-accent" /><div><p className="font-semibold">Saved project briefs could not be loaded.</p><p className="mt-1 text-sm text-muted-foreground">The project brief service may be temporarily unavailable.</p></div></div><button type="button" onClick={() => void query.refetch()} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Try again</button></div> : briefs.length === 0 ? <div className="mt-6 border border-dashed border-border bg-card p-8 text-center" data-testid="status-saved-project-briefs-empty"><MessageSquareText className="mx-auto size-6 text-accent" /><p className="mt-4 font-semibold">No saved project briefs yet.</p><p className="mt-2 text-sm text-muted-foreground">Save your first rough brief and it will stay available in your planning desk.</p><Link href="/projects" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-accent">Create a project brief <ArrowRight className="size-4" /></Link></div> : <div className="mt-6 grid gap-4 md:grid-cols-2">{briefs.map((brief) => <SavedProjectBriefCard key={brief.id} brief={brief} />)}</div>}
  </section>;
}

function SavedProjectBriefCard({ brief }: { brief: ProjectBrief }) {
  return <article className="rounded-2xl border border-border bg-card p-6" data-testid={`card-saved-project-brief-${brief.id}`}>
    <div className="flex items-start justify-between gap-4"><div><p className="font-mono-ui text-[9px] font-bold uppercase tracking-[.14em] text-muted-foreground">{formatProjectBriefDate(brief.createdAt)}</p><h3 className="mt-2 font-display text-2xl font-bold tracking-[-.04em]">{brief.projectType}</h3><p className="mt-1 text-sm text-muted-foreground">For {brief.name}</p></div><MessageSquareText className="size-5 shrink-0 text-accent" /></div>
    <p className="mt-5 flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4 shrink-0 text-accent" />{brief.location}</p>
    <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">{brief.description}</p>
    <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm"><div><p className="text-xs text-muted-foreground">Budget</p><p className="mt-1 font-bold">{brief.budget}</p></div><div><p className="text-xs text-muted-foreground">Timeline</p><p className="mt-1 font-bold">{brief.timeline}</p></div></div>
  </article>;
}

function SavedEstimates() {
  const query = useListConstructionEstimates();
  const estimates = query.data ?? [];

  return <section className="mt-6 border-t border-border pt-10" data-testid="section-saved-estimates">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><SectionLabel>Saved estimates</SectionLabel><h2 className="mt-3 font-display text-3xl font-bold tracking-[-.05em]">Your calculator history</h2></div>
      <Link href="/calculator" className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">New estimate <Calculator className="size-4" /></Link>
    </div>
    {query.isLoading ? <div className="mt-6 grid gap-4 md:grid-cols-2"><div className="h-48 animate-pulse rounded-2xl border border-border bg-muted/60" /><div className="h-48 animate-pulse rounded-2xl border border-border bg-muted/60" /></div> : query.isError ? <div className="mt-6 rounded-2xl border border-accent/30 bg-accent/10 p-6" data-testid="status-saved-estimates-error"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 size-5 shrink-0 text-accent" /><div><p className="font-semibold">Saved estimates could not be loaded.</p><p className="mt-1 text-sm text-muted-foreground">The estimate service may be temporarily unavailable.</p></div></div><button type="button" onClick={() => void query.refetch()} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Try again</button></div> : estimates.length === 0 ? <div className="mt-6 border border-dashed border-border bg-card p-8 text-center" data-testid="status-saved-estimates-empty"><Calculator className="mx-auto size-6 text-accent" /><p className="mt-4 font-semibold">No saved estimates yet.</p><p className="mt-2 text-sm text-muted-foreground">Calculate an area and save it here for your next planning session.</p><Link href="/calculator" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-accent">Open the calculator <ArrowRight className="size-4" /></Link></div> : <div className="mt-6 grid gap-4 md:grid-cols-2">{estimates.map((estimate) => <SavedEstimateCard key={estimate.id} estimate={estimate} />)}</div>}
  </section>;
}

function SavedEstimateCard({ estimate }: { estimate: ConstructionEstimate }) {
  return <article className="rounded-2xl border border-border bg-card p-6" data-testid={`card-saved-estimate-${estimate.id}`}>
    <div className="flex items-start justify-between gap-4"><div><p className="font-mono-ui text-[9px] font-bold uppercase tracking-[.14em] text-muted-foreground">{formatEstimateDate(estimate.createdAt)}</p><h3 className="mt-2 font-display text-2xl font-bold tracking-[-.04em]">{finishLevels[estimate.quality].label}</h3></div><Calculator className="size-5 text-accent" /></div>
    <p className="mt-6 font-display text-3xl font-bold tracking-[-.05em]">{formatPkrRange(estimate.estimatedMin, estimate.estimatedMax)}</p>
    <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm"><div><p className="text-xs text-muted-foreground">Covered area</p><p className="mt-1 font-bold">{estimate.totalCoveredAreaSqFt.toLocaleString("en-PK")} sq ft</p></div><div><p className="text-xs text-muted-foreground">Rate</p><p className="mt-1 font-bold">{formatPkrRange(estimate.costPerSqFtMin, estimate.costPerSqFtMax)} / sq ft</p></div></div>
  </article>;
}
function DashboardRow({ icon, label, value, href }: { icon: ReactNode; label: string; value: string; href: string }) { return <Link href={href} data-testid={`link-dashboard-${label.toLowerCase().replaceAll(" ", "-")}`} className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted"><span className="grid size-9 place-items-center rounded-lg bg-muted text-accent">{icon}</span><span className="flex-1"><span className="block text-sm font-bold">{label}</span><span className="block text-xs text-muted-foreground">{value}</span></span><ChevronDown className="size-4 rotate-[-90deg] text-muted-foreground" /></Link>; }

export { About, Assistant, AuthPage, CalculatorPage, Dashboard, Home, Marketplace, ProfessionalProfilePage, Professionals, Projects };