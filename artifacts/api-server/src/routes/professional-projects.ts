import { getAuth } from "@clerk/express";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import {
  CreateProfessionalProjectBody,
  CreateMyProfessionalProjectResponse,
  CreateQuoteRequestBody,
  isAllowedLogoUrl,
  ListMyProfessionalProjectsResponse,
  ListMyQuoteRequestsResponse,
  ListPublicProfessionalProjectsResponse,
  LOGO_URL_ERROR_MESSAGE,
  CreateProfessionalQuoteRequestResponse,
  UpdateMyProfessionalProjectBody,
  UpdateMyProfessionalProjectResponse,
} from "@workspace/api-zod";
import {
  professionalProjects,
  professionals,
  professionalQuoteRequests,
  type ProfessionalProjectRow,
  type ProfessionalQuoteRequestRow,
} from "@workspace/db/schema";
import { isUuid } from "../lib/validation";

const router: IRouter = Router();

/**
 * A public showcase is bounded so a single professional cannot make the
 * directory page unbounded. This is a cap, not pagination.
 */
const PUBLIC_PROJECT_LIMIT = 50;

function authenticatedUserId(req: Request) {
  return getAuth(req).userId;
}

/**
 * Defense in depth. The authoritative rule is the shared `@workspace/api-zod`
 * validator, which is already applied by CreateProfessionalProjectBody /
 * UpdateMyProfessionalProjectBody. This reuses the same predicate to normalise
 * the value instead of re-implementing the protocol allowlist.
 */
function parseImageUrl(
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

function serializeProject(row: ProfessionalProjectRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Public read model. It deliberately omits the owning professional id and the
 * `updatedAt` churn: nothing here identifies the owner beyond the professional
 * the caller already asked for.
 */
function serializePublicProject(row: ProfessionalProjectRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    location: row.location ?? null,
    imageUrl: row.imageUrl ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeQuoteRequest(row: ProfessionalQuoteRequestRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    size: row.size,
    details: row.details,
    imageUrls: Array.isArray(row.imageUrls) ? row.imageUrls : [],
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Resolves the caller's own professional row from the Clerk session. The
 * professional id is never read from the request body or path for the
 * management routes, so a client cannot address another professional's
 * portfolio.
 */
async function ownProfessionalId(req: Request) {
  const userId = authenticatedUserId(req);
  if (!userId) return null;

  const { db } = await import("@workspace/db");
  const [row] = await db
    .select({ id: professionals.id })
    .from(professionals)
    .where(eq(professionals.clerkUserId, userId))
    .limit(1);

  return row?.id ?? null;
}

router.get("/professionals/me/projects", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to view your portfolio." });
    return;
  }

  try {
    const professionalId = await ownProfessionalId(req);
    if (!professionalId) {
      res.status(404).json({ error: "No professional profile found." });
      return;
    }

    const { db } = await import("@workspace/db");
    const rows = await db
      .select()
      .from(professionalProjects)
      .where(eq(professionalProjects.professionalId, professionalId))
      .orderBy(desc(professionalProjects.createdAt));

    res.json(ListMyProfessionalProjectsResponse.parse(rows.map(serializeProject)));
  } catch (error) {
    req.log.error({ err: error }, "Unable to load portfolio projects");
    res.status(500).json({ error: "Unable to load your portfolio. Please try again." });
  }
});

router.post("/professionals/me/projects", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to add a portfolio project." });
    return;
  }

  const parsed = CreateProfessionalProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the project details you sent." });
    return;
  }

  const imageUrl = parseImageUrl(parsed.data.imageUrl);
  if (!imageUrl.ok) {
    res.status(400).json({ error: LOGO_URL_ERROR_MESSAGE });
    return;
  }

  const title = parsed.data.title?.trim() ?? "";
  if (!title) {
    res.status(400).json({ error: "A project title is required." });
    return;
  }

  try {
    const professionalId = await ownProfessionalId(req);
    if (!professionalId) {
      res.status(404).json({ error: "No professional profile found." });
      return;
    }

    const { db } = await import("@workspace/db");
    const [created] = await db
      .insert(professionalProjects)
      .values({
        professionalId,
        title,
        description: optionalText(parsed.data.description),
        location: optionalText(parsed.data.location),
        imageUrl: imageUrl.value,
      })
      .returning();

    if (!created) {
      res.status(500).json({ error: "Unable to add the project." });
      return;
    }

    res
      .status(201)
      .json(CreateMyProfessionalProjectResponse.parse(serializeProject(created)));
  } catch (error) {
    req.log.error({ err: error }, "Unable to create portfolio project");
    res.status(500).json({ error: "Unable to add the project." });
  }
});

router.patch(
  "/professionals/me/projects/:id",
  async (req, res): Promise<void> => {
    const userId = authenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Sign in to update a portfolio project." });
      return;
    }

    const parsed = UpdateMyProfessionalProjectBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Check the project details you sent." });
      return;
    }

    if (!isUuid(req.params.id)) {
      res.status(404).json({ error: "No such portfolio project." });
      return;
    }

    // "Omitted" and "explicitly empty" stay distinguishable: only a supplied
    // key may change the stored image, so clearing works and omitting does not.
    const imageUrlWasSupplied = parsed.data.imageUrl !== undefined;
    let normalizedImageUrl: string | null = null;
    if (imageUrlWasSupplied) {
      const imageUrl = parseImageUrl(parsed.data.imageUrl);
      if (!imageUrl.ok) {
        res.status(400).json({ error: LOGO_URL_ERROR_MESSAGE });
        return;
      }
      normalizedImageUrl = imageUrl.value;
    }

    const input = parsed.data;
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (input.title !== undefined) values.title = input.title.trim();
    if (input.description !== undefined) {
      values.description = optionalText(input.description);
    }
    if (input.location !== undefined) {
      values.location = optionalText(input.location);
    }
    if (imageUrlWasSupplied) values.imageUrl = normalizedImageUrl;

    if (values.title === "") {
      res.status(400).json({ error: "A project title is required." });
      return;
    }

    try {
      const professionalId = await ownProfessionalId(req);
      if (!professionalId) {
        res.status(404).json({ error: "No professional profile found." });
        return;
      }

      const { db } = await import("@workspace/db");
      // Ownership is part of the WHERE clause, so another professional's
      // project simply does not match and cannot be read or written.
      const [updated] = await db
        .update(professionalProjects)
        .set(values)
        .where(
          and(
            eq(professionalProjects.id, req.params.id),
            eq(professionalProjects.professionalId, professionalId),
          ),
        )
        .returning();

      if (!updated) {
        res.status(404).json({ error: "No such portfolio project." });
        return;
      }

      res
        .status(200)
        .json(UpdateMyProfessionalProjectResponse.parse(serializeProject(updated)));
    } catch (error) {
      req.log.error({ err: error }, "Unable to update portfolio project");
      res.status(500).json({ error: "Unable to update the project." });
    }
  },
);

router.delete(
  "/professionals/me/projects/:id",
  async (req, res): Promise<void> => {
    const userId = authenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Sign in to delete a portfolio project." });
      return;
    }

    if (!isUuid(req.params.id)) {
      res.status(404).json({ error: "No such portfolio project." });
      return;
    }

    try {
      const professionalId = await ownProfessionalId(req);
      if (!professionalId) {
        res.status(404).json({ error: "No professional profile found." });
        return;
      }

      const { db } = await import("@workspace/db");
      const [deleted] = await db
        .delete(professionalProjects)
        .where(
          and(
            eq(professionalProjects.id, req.params.id),
            eq(professionalProjects.professionalId, professionalId),
          ),
        )
        .returning();

      if (!deleted) {
        res.status(404).json({ error: "No such portfolio project." });
        return;
      }

      res.status(204).send();
    } catch (error) {
      req.log.error({ err: error }, "Unable to delete portfolio project");
      res.status(500).json({ error: "Unable to delete the project." });
    }
  },
);

// Declared last so the literal "/professionals/me/projects" routes above always
// win: otherwise ":id" would try to match the segment "me".
router.get("/professionals/:id/projects", async (req, res): Promise<void> => {
  if (!isUuid(req.params.id)) {
    res.status(404).json({ error: "No such professional." });
    return;
  }

  try {
    const { db } = await import("@workspace/db");
    const [professional] = await db
      .select({ id: professionals.id })
      .from(professionals)
      .where(eq(professionals.id, req.params.id))
      .limit(1);

    if (!professional) {
      res.status(404).json({ error: "No such professional." });
      return;
    }

    const rows = await db
      .select()
      .from(professionalProjects)
      .where(eq(professionalProjects.professionalId, professional.id))
      .orderBy(desc(professionalProjects.createdAt))
      .limit(PUBLIC_PROJECT_LIMIT);

    res.json(
      ListPublicProfessionalProjectsResponse.parse(
        rows.map(serializePublicProject),
      ),
    );
  } catch (error) {
    req.log.error({ err: error }, "Unable to load public portfolio projects");
    res.status(500).json({ error: "Unable to load this portfolio." });
  }
});

router.get("/professionals/me/quotes", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to view your quote requests." });
    return;
  }

  try {
    // Ownership comes from the Clerk session through the professional row, so a
    // client cannot ask for another professional's requests.
    const professionalId = await ownProfessionalId(req);
    if (!professionalId) {
      res.status(404).json({ error: "No professional profile found." });
      return;
    }

    const { db } = await import("@workspace/db");
    const rows = await db
      .select()
      .from(professionalQuoteRequests)
      .where(eq(professionalQuoteRequests.professionalId, professionalId))
      .orderBy(desc(professionalQuoteRequests.createdAt));

    res.json(ListMyQuoteRequestsResponse.parse(rows.map(serializeQuoteRequest)));
  } catch (error) {
    req.log.error({ err: error }, "Unable to load quote requests");
    res.status(500).json({ error: "Unable to load your quote requests." });
  }
});

router.post("/professionals/:id/quote", async (req, res): Promise<void> => {
  if (!isUuid(req.params.id)) {
    res.status(404).json({ error: "No such professional." });
    return;
  }

  const parsed = CreateQuoteRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the quote request you sent." });
    return;
  }

  const imageUrls = parsed.data.imageUrls ?? [];
  for (const candidate of imageUrls) {
    // Defense in depth. The shared validator already rejected anything unsafe
    // when the body was parsed; this reuses the same predicate rather than
    // re-implementing the protocol allowlist.
    if (!isAllowedLogoUrl(candidate)) {
      res.status(400).json({ error: LOGO_URL_ERROR_MESSAGE });
      return;
    }
  }

  try {
    const { db } = await import("@workspace/db");
    // Confirms the professional exists before writing, so a request can never
    // become an orphan.
    const [professional] = await db
      .select({ id: professionals.id })
      .from(professionals)
      .where(eq(professionals.id, req.params.id))
      .limit(1);

    if (!professional) {
      res.status(404).json({ error: "No such professional." });
      return;
    }

    const [created] = await db
      .insert(professionalQuoteRequests)
      .values({
        professionalId: professional.id,
        name: parsed.data.name.trim(),
        email: parsed.data.email.trim(),
        size: parsed.data.size.trim(),
        details: parsed.data.details.trim(),
        imageUrls: imageUrls.map((candidate) => candidate.trim()),
      })
      .returning();

    if (!created) {
      res.status(500).json({ error: "Unable to send your request." });
      return;
    }

    res
      .status(201)
      .json(CreateProfessionalQuoteRequestResponse.parse(serializeQuoteRequest(created)));
  } catch (error) {
    req.log.error({ err: error }, "Unable to create quote request");
    res.status(500).json({ error: "Unable to send your request." });
  }
});

export default router;
