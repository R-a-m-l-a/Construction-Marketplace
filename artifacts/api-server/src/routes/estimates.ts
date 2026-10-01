import { getAuth } from "@clerk/express";
import { desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import {
  CreateConstructionEstimateBody,
  CreateConstructionEstimateResponse,
  ListConstructionEstimatesResponse,
  type CreateConstructionEstimateBodyType,
} from "@workspace/api-zod";
import {
  constructionEstimates,
  type ConstructionEstimate as ConstructionEstimateRow,
} from "@workspace/db/schema";

const router: IRouter = Router();
const MAX_COVERED_AREA_SQ_FT = 250_000;
const FINISH_RATES = {
  basic: 4_200,
  standard: 5_600,
  premium: 7_200,
} as const satisfies Record<CreateConstructionEstimateBodyType["quality"], number>;

function authenticatedUserId(req: Request) {
  return getAuth(req).userId;
}

function serializeEstimate(row: ConstructionEstimateRow) {
  return {
    id: row.id,
    location: row.location,
    plotSize: Number(row.plotSize),
    plotUnit: row.plotUnit,
    plotAreaSqFt: row.plotAreaSqFt,
    coveredAreaMode: row.coveredAreaMode,
    coveredAreaBasis: row.coveredAreaBasis,
    coveredAreaValue: Number(row.coveredAreaValue),
    floorCount: row.floorCount,
    floors: row.floors,
    constructionType: row.constructionType,
    quality: row.quality,
    totalCoveredAreaSqFt: row.totalCoveredAreaSqFt,
    greyMin: row.greyMin,
    greyMax: row.greyMax,
    finishingMin: row.finishingMin,
    finishingMax: row.finishingMax,
    estimatedMin: row.estimatedMin,
    estimatedMax: row.estimatedMax,
    costPerSqFtMin: row.costPerSqFtMin,
    costPerSqFtMax: row.costPerSqFtMax,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/estimates", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to view saved estimates." });
    return;
  }

  try {
    const { db } = await import("@workspace/db");
    const rows = await db
      .select()
      .from(constructionEstimates)
      .where(eq(constructionEstimates.userId, userId))
      .orderBy(desc(constructionEstimates.createdAt));

    res.json(ListConstructionEstimatesResponse.parse(rows.map(serializeEstimate)));
  } catch (error) {
    req.log.error({ err: error }, "Unable to load construction estimates");
    res.status(500).json({ error: "Unable to load saved estimates. Please try again." });
  }
});

router.post("/estimates", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to save an estimate." });
    return;
  }

  const parsed = CreateConstructionEstimateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter valid estimate data and try again." });
    return;
  }

  const input = parsed.data;
  if (
    !Number.isInteger(input.totalCoveredAreaSqFt) ||
    input.totalCoveredAreaSqFt < 1 ||
    input.totalCoveredAreaSqFt > MAX_COVERED_AREA_SQ_FT
  ) {
    res.status(400).json({
      error: "Covered area must be a whole number from 1 to 250,000 sq ft.",
    });
    return;
  }

  const rate = FINISH_RATES[input.quality];
  const estimatedTotal = input.totalCoveredAreaSqFt * rate;

  try {
    const { db } = await import("@workspace/db");
    const [created] = await db
      .insert(constructionEstimates)
      .values({
        userId,
        location: input.location,
        plotSize: String(input.plotSize),
        plotUnit: input.plotUnit,
        plotAreaSqFt: input.plotAreaSqFt,
        coveredAreaMode: input.coveredAreaMode,
        coveredAreaBasis: input.coveredAreaBasis,
        coveredAreaValue: String(input.coveredAreaValue),
        floorCount: input.floorCount,
        floors: input.floors,
        constructionType: input.constructionType,
        quality: input.quality,
        totalCoveredAreaSqFt: input.totalCoveredAreaSqFt,
        greyMin: 0,
        greyMax: 0,
        finishingMin: estimatedTotal,
        finishingMax: estimatedTotal,
        estimatedMin: estimatedTotal,
        estimatedMax: estimatedTotal,
        costPerSqFtMin: rate,
        costPerSqFtMax: rate,
      })
      .returning();

    if (!created) {
      res.status(500).json({ error: "Unable to save estimate. Please try again." });
      return;
    }

    res.status(201).json(CreateConstructionEstimateResponse.parse(serializeEstimate(created)));
  } catch (error) {
    req.log.error({ err: error }, "Unable to save construction estimate");
    res.status(500).json({ error: "Unable to save estimate. Please try again." });
  }
});

export default router;
