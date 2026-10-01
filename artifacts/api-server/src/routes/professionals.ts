import { getAuth } from "@clerk/express";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import {
  CreateProfessionalBody,
  CreateProfessionalResponse,
  GetMyProfessionalResponse,
  GetPublicProfessionalResponse,
  isAllowedLogoUrl,
  ListPublicProfessionalsResponse,
  LOGO_URL_ERROR_MESSAGE,
  UpdateMyProfessionalBody,
  UpdateMyProfessionalResponse,
} from "@workspace/api-zod";
import {
  professionals,
  type ProfessionalRow,
} from "@workspace/db/schema";
import { isUuid } from "../lib/validation";
import {
  containsPattern,
  presentFields,
  queryString,
  rankByTypo,
  searchTokens,
} from "../lib/search";

const router: IRouter = Router();
const PUBLIC_PROFESSIONAL_LIMIT = 100;

function authenticatedUserId(req: Request) {
  return getAuth(req).userId;
}

/**
 * Defense in depth only. The authoritative logo rule lives in the shared
 * `@workspace/api-zod` validator (also applied by CreateProfessionalBody /
 * UpdateMyProfessionalBody); this reuses that same predicate to normalise the
 * value instead of re-implementing the protocol allowlist.
 */
function parseLogoUrl(
  value: unknown,
): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false };

  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!isAllowedLogoUrl(trimmed)) return { ok: false };

  return { ok: true, value: trimmed };
}

function optionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function serializeProfessional(row: ProfessionalRow) {
  return {
    id: row.id,
    name: row.name,
    profession: row.profession,
    category: row.category,
    services: row.services,
    bio: row.bio ?? undefined,
    city: row.city,
    location: row.location ?? undefined,
    logoUrl: row.logoUrl ?? undefined,
    phone: row.phone ?? undefined,
    whatsapp: row.whatsapp ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializePublicProfessional(row: ProfessionalRow) {
  return {
    id: row.id,
    name: row.name,
    profession: row.profession,
    category: row.category,
    services: row.services,
    city: row.city,
    location: row.location ?? null,
    logoUrl: row.logoUrl ?? null,
    // Public by design from Phase 5D: these are the contact details the
    // professional entered on their own profile, used by the Call now and
    // WhatsApp actions on the public profile.
    phone: row.phone ?? null,
    whatsapp: row.whatsapp ?? null,
  };
}

type PublicProfessionalFilters = {
  query?: string;
  city?: string;
  location?: string;
  category?: string;
  services?: string;
};

function publicProfessionalFilters(req: Request): PublicProfessionalFilters {
  return {
    query: queryString(req.query.query),
    city: queryString(req.query.city),
    location: queryString(req.query.location),
    category: queryString(req.query.category),
    services: queryString(req.query.services),
  };
}

/**
 * The structured facets stay exact-ish and predictable: a plain case
 * insensitive substring match, never a fuzzy one.
 */
function structuredFilters(filters: PublicProfessionalFilters): SQL | undefined {
  const conditions: SQL[] = [];

  for (const [field, value] of [
    ["city", filters.city],
    ["location", filters.location],
    ["category", filters.category],
    ["services", filters.services],
  ] as const) {
    const trimmed = value?.trim();
    if (trimmed) {
      conditions.push(ilike(professionals[field], containsPattern(trimmed)));
    }
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function searchFilter(term: string): SQL | undefined {
  const conditions: SQL[] = [];

  for (const token of searchTokens(term)) {
    const pattern = containsPattern(token);
    const tokenMatch = or(
      ilike(professionals.name, pattern),
      ilike(professionals.profession, pattern),
      ilike(professionals.category, pattern),
      ilike(professionals.services, pattern),
      ilike(professionals.city, pattern),
      ilike(professionals.location, pattern),
    );
    if (tokenMatch) conditions.push(tokenMatch);
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

/**
 * The public, filterable values of one professional, used for the in-memory
 * typo fallback. Entity-specific by design: the shared helpers stay generic.
 */
function publicSearchFields(row: ProfessionalRow): string[] {
  return presentFields([
    row.name,
    row.profession,
    row.category,
    row.services,
    row.city,
    row.location,
  ]);
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

router.get("/professionals", async (req, res): Promise<void> => {
  try {
    const { db } = await import("@workspace/db");
    const filters = publicProfessionalFilters(req);
    const term = filters.query?.trim() ?? "";
    const structured = structuredFilters(filters);
    const search = term ? searchFilter(term) : undefined;

    const select = (extra: SQL | undefined) => {
      const conditions = [structured, extra].filter(
        (condition): condition is SQL => condition !== undefined,
      );
      const combined = conditions.length > 0 ? and(...conditions) : undefined;
      const base = db.select().from(professionals);
      return (combined ? base.where(combined) : base)
        .orderBy(desc(professionals.createdAt))
        .limit(PUBLIC_PROFESSIONAL_LIMIT);
    };

    let rows = await select(search);

    // Typo tolerance only kicks in when the substring search matched nothing, so
    // exact and normal substring results are returned untouched. Candidates are
    // still narrowed by the structured filters, which are never fuzzed.
    if (rows.length === 0 && term) {
      const candidates = await select(undefined);
      rows = rankByTypo(candidates, searchTokens(term), publicSearchFields);
    }

    res.json(
      ListPublicProfessionalsResponse.parse(rows.map(serializePublicProfessional)),
    );
  } catch (error) {
    req.log.error({ err: error }, "Unable to load public professionals");
    res
      .status(500)
      .json({ error: "Unable to load professionals. Please try again." });
  }
});

router.get("/professionals/me", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to view your professional profile." });
    return;
  }

  try {
    const { db } = await import("@workspace/db");
    const [row] = await db
      .select()
      .from(professionals)
      .where(eq(professionals.clerkUserId, userId))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "No professional profile found." });
      return;
    }

    res.json(GetMyProfessionalResponse.parse(serializeProfessional(row)));
  } catch (error) {
    req.log.error({ err: error }, "Unable to load professional profile");
    res
      .status(500)
      .json({ error: "Unable to load your professional profile." });
  }
});

// Declared after "/professionals/me" so the literal route always wins: ":id"
// would otherwise try to match the segment "me".
router.get("/professionals/:id", async (req, res): Promise<void> => {
  if (!isUuid(req.params.id)) {
    res.status(404).json({ error: "No such professional." });
    return;
  }

  try {
    const { db } = await import("@workspace/db");
    const [row] = await db
      .select()
      .from(professionals)
      .where(eq(professionals.id, req.params.id))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "No such professional." });
      return;
    }

    res.json(GetPublicProfessionalResponse.parse(serializePublicProfessional(row)));
  } catch (error) {
    req.log.error({ err: error }, "Unable to load public professional");
    res
      .status(500)
      .json({ error: "Unable to load this professional. Please try again." });
  }
});

router.post("/professionals", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req);
  if (!userId) {
    res
      .status(401)
      .json({ error: "Sign in to create a professional profile." });
    return;
  }

  const parsed = CreateProfessionalBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Complete all required professional fields." });
    return;
  }

  const logoUrl = parseLogoUrl(parsed.data.logoUrl);
  if (!logoUrl.ok) {
    res.status(400).json({ error: LOGO_URL_ERROR_MESSAGE });
    return;
  }

  const input = parsed.data;
  const values = {
    // Ownership always comes from the authenticated Clerk session.
    clerkUserId: userId,
    name: input.name.trim(),
    profession: input.profession.trim(),
    category: input.category.trim(),
    services: input.services.trim(),
    bio: optionalText(input.bio),
    city: input.city.trim(),
    location: optionalText(input.location),
    logoUrl: logoUrl.value,
    phone: optionalText(input.phone),
    whatsapp: optionalText(input.whatsapp),
  };

  if (
    !values.name ||
    !values.profession ||
    !values.category ||
    !values.services ||
    !values.city
  ) {
    res.status(400).json({
      error: "Name, profession, category, services, and city are required.",
    });
    return;
  }

  try {
    const { db } = await import("@workspace/db");
    const [existing] = await db
      .select({ id: professionals.id })
      .from(professionals)
      .where(eq(professionals.clerkUserId, userId))
      .limit(1);

    if (existing) {
      res.status(400).json({
        error: "You already have a professional profile. Update it instead.",
      });
      return;
    }

    const [created] = await db
      .insert(professionals)
      .values(values)
      .returning();

    if (!created) {
      res
        .status(500)
        .json({ error: "Unable to create professional profile." });
      return;
    }

    res
      .status(201)
      .json(CreateProfessionalResponse.parse(serializeProfessional(created)));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(400).json({
        error: "You already have a professional profile. Update it instead.",
      });
      return;
    }
    req.log.error({ err: error }, "Unable to create professional profile");
    res
      .status(500)
      .json({ error: "Unable to create your professional profile." });
  }
});

router.patch("/professionals/me", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req);
  if (!userId) {
    res
      .status(401)
      .json({ error: "Sign in to update your professional profile." });
    return;
  }

  const parsed = UpdateMyProfessionalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the professional details you sent." });
    return;
  }

  // "Omitted" and "explicitly empty" are different intents and must stay
  // distinguishable: an absent key means "leave the stored logo alone", while
  // "" or whitespace means "clear it". parseLogoUrl already normalises "" and
  // whitespace to null, so the presence of the key is tracked separately here
  // instead of collapsing null back to undefined, which the field-assignment
  // guards below read as "not supplied" and would silently skip the clear.
  const logoUrlWasSupplied = parsed.data.logoUrl !== undefined;
  let normalizedLogoUrl: string | null = null;
  if (logoUrlWasSupplied) {
    const logoUrl = parseLogoUrl(parsed.data.logoUrl);
    if (!logoUrl.ok) {
      res.status(400).json({ error: LOGO_URL_ERROR_MESSAGE });
      return;
    }
    normalizedLogoUrl = logoUrl.value;
  }

  const input = parsed.data;
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) values.name = input.name.trim();
  if (input.profession !== undefined) values.profession = input.profession.trim();
  if (input.category !== undefined) values.category = input.category.trim();
  if (input.services !== undefined) values.services = input.services.trim();
  if (input.bio !== undefined) values.bio = optionalText(input.bio);
  if (input.city !== undefined) values.city = input.city.trim();
  if (input.location !== undefined) values.location = optionalText(input.location);
  if (logoUrlWasSupplied) values.logoUrl = normalizedLogoUrl;
  if (input.phone !== undefined) values.phone = optionalText(input.phone);
  if (input.whatsapp !== undefined) values.whatsapp = optionalText(input.whatsapp);

  for (const key of ["name", "profession", "category", "services", "city"] as const) {
    if (values[key] === "") {
      res.status(400).json({
        error: "Name, profession, category, services, and city cannot be empty.",
      });
      return;
    }
  }

  try {
    const { db } = await import("@workspace/db");
    const [updated] = await db
      .update(professionals)
      .set(values)
      .where(eq(professionals.clerkUserId, userId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "No professional profile found." });
      return;
    }

    res
      .status(200)
      .json(UpdateMyProfessionalResponse.parse(serializeProfessional(updated)));
  } catch (error) {
    req.log.error({ err: error }, "Unable to update professional profile");
    res
      .status(500)
      .json({ error: "Unable to update your professional profile." });
  }
});

export default router;
