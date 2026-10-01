import { getAuth } from "@clerk/express";
import { desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import {
  CreateProjectBriefBody,
  CreateProjectBriefResponse,
  ListProjectBriefsResponse,
} from "@workspace/api-zod";
import {
  projectBriefs,
  type ProjectBriefRow,
} from "@workspace/db/schema";

const router: IRouter = Router();

function authenticatedUserId(req: Request) {
  return getAuth(req).userId;
}

function serializeProjectBrief(row: ProjectBriefRow) {
  return {
    id: row.id,
    name: row.name,
    projectType: row.projectType,
    location: row.location,
    budget: row.budget,
    timeline: row.timeline,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/project-briefs", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to view saved project briefs." });
    return;
  }

  try {
    const { db } = await import("@workspace/db");
    const rows = await db
      .select()
      .from(projectBriefs)
      .where(eq(projectBriefs.userId, userId))
      .orderBy(desc(projectBriefs.createdAt));

    res.json(ListProjectBriefsResponse.parse(rows.map(serializeProjectBrief)));
  } catch (error) {
    req.log.error({ err: error }, "Unable to load project briefs");
    res.status(500).json({ error: "Unable to load project briefs. Please try again." });
  }
});

router.post("/project-briefs", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to save a project brief." });
    return;
  }

  const parsed = CreateProjectBriefBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Complete all project brief fields and try again." });
    return;
  }

  const input = {
    ...parsed.data,
    name: parsed.data.name.trim(),
    location: parsed.data.location.trim(),
    description: parsed.data.description.trim(),
  };

  if (!input.name || input.location.length < 2 || !input.description) {
    res.status(400).json({ error: "Enter a name, location, and project description." });
    return;
  }

  try {
    const { db } = await import("@workspace/db");
    const [created] = await db
      .insert(projectBriefs)
      .values({
        userId,
        name: input.name,
        projectType: input.projectType,
        location: input.location,
        budget: input.budget,
        timeline: input.timeline,
        description: input.description,
      })
      .returning();

    if (!created) {
      res.status(500).json({ error: "Unable to save project brief. Please try again." });
      return;
    }

    res.status(201).json(CreateProjectBriefResponse.parse(serializeProjectBrief(created)));
  } catch (error) {
    req.log.error({ err: error }, "Unable to save project brief");
    res.status(500).json({ error: "Unable to save project brief. Please try again." });
  }
});

export default router;
