import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const projectBriefs = pgTable("project_briefs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  projectType: text("project_type").notNull(),
  location: text("location").notNull(),
  budget: text("budget").notNull(),
  timeline: text("timeline").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const insertProjectBriefSchema = createInsertSchema(projectBriefs).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertProjectBrief = typeof projectBriefs.$inferInsert;
export type ProjectBriefRow = typeof projectBriefs.$inferSelect;
