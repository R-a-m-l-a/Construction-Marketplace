import { Router, type IRouter } from "express";
import { and, desc, isNotNull, sql } from "drizzle-orm";
import {
  GetDiscoveryStatsResponse,
  ListFeaturedProfessionalsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * Phase 6D: the last of the demo discovery data is gone.
 *
 * The hard-coded category and product arrays were removed in Phase 6A and the
 * demo professional previews in this phase. Everything served here is now a
 * real database count or a real database row, and each endpoint returns an
 * honest empty result rather than falling back to invented records.
 */

/**
 * A "featured" professional is the most recently created real profile.
 *
 * The `professionals` table has no featured column, so newest-first is the
 * honest ordering and avoids inventing a flag that nothing maintains. The read
 * model matches the public discovery model minus the contact fields: a listing
 * preview is not a contact surface, and the Call and WhatsApp actions already
 * live on the public profile page.
 *
 * `clerkUserId` is never selected, so ownership cannot leak through this
 * preview.
 */
router.get("/professionals/featured", async (req, res): Promise<void> => {
  try {
    const { db } = await import("@workspace/db");
    const { professionals } = await import("@workspace/db/schema");

    const rows = await db
      .select({
        id: professionals.id,
        name: professionals.name,
        profession: professionals.profession,
        category: professionals.category,
        services: professionals.services,
        city: professionals.city,
        location: professionals.location,
        logoUrl: professionals.logoUrl,
      })
      .from(professionals)
      .orderBy(desc(professionals.createdAt), desc(professionals.id))
      .limit(6);

    res.json(
      ListFeaturedProfessionalsResponse.parse(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          profession: row.profession,
          category: row.category,
          services: row.services,
          city: row.city,
          location: row.location ?? null,
          logoUrl: row.logoUrl ?? null,
        })),
      ),
    );
  } catch (error) {
    req.log.error({ err: error }, "Unable to load featured professionals");
    res
      .status(500)
      .json({ error: "Unable to load professional profiles. Please try again." });
  }
});

/**
 * Discovery statistics, all derived from the database.
 *
 * The homepage renders these beside the labels "material leads", "trade
 * categories" and "cities covered". Each count therefore maps to the table that
 * backs its own label rather than to an unrelated one:
 *
 * - `marketplaceItems`: published products, the marketplace surface.
 * - `professionalCategories`: distinct `professionals.category` values, the
 *   "trade categories" stat.
 * - `citiesCovered`: distinct `professionals.city` values. "Cities covered"
 *   sits directly beside "trade categories" in the same three-stat strip, so
 *   both describe professional coverage; the narrowest reading consistent with
 *   that layout is professional cities, and it is what the value is taken
 *   from.
 *
 * Rows with a blank city or category are excluded so an empty string cannot be
 * counted as a real place or trade.
 */
router.get("/discovery/stats", async (req, res): Promise<void> => {
  try {
    const { db } = await import("@workspace/db");
    const { products, professionals } = await import("@workspace/db/schema");

    const [productCount] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(products);

    const [categoryCount] = await db
      .select({ value: sql<number>`count(distinct category)::int` })
      .from(professionals)
      .where(
        and(
          isNotNull(professionals.category),
          sql`length(trim(${professionals.category})) > 0`,
        ),
      );

    const [cityCount] = await db
      .select({ value: sql<number>`count(distinct city)::int` })
      .from(professionals)
      .where(
        and(
          isNotNull(professionals.city),
          sql`length(trim(${professionals.city})) > 0`,
        ),
      );

    res.json(
      GetDiscoveryStatsResponse.parse({
        marketplaceItems: productCount?.value ?? 0,
        professionalCategories: categoryCount?.value ?? 0,
        citiesCovered: cityCount?.value ?? 0,
        demoNotice:
          "All discovery figures come from live records: materials are published by suppliers, and professional profiles are real accounts.",
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Unable to load discovery stats");
    res
      .status(500)
      .json({ error: "Unable to load discovery stats. Please try again." });
  }
});

export default router;
