import { createInsertSchema } from "drizzle-zod";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { professionals } from "./professionals";

/**
 * Phase 5C portfolio. A project belongs to exactly one professional, which is
 * the only ownership link: the Clerk user is never stored here, it is resolved
 * through the owning professional row at request time.
 *
 * Deliberately minimal. Only the fields the verified portfolio scope needs are
 * modelled: what the work was, where it was, and an optional reference image.
 * There is no project type, year, ordering, tagging or status field, and no
 * media binary: `imageUrl` stores a link only, exactly like `logoUrl`.
 */
export const professionalProjects = pgTable(
  "professional_projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Every read of this table is scoped to one professional.
    index("professional_projects_professional_id_idx").on(table.professionalId),
  ],
);

export const insertProfessionalProjectSchema =
  createInsertSchema(professionalProjects).omit({
    id: true,
    professionalId: true,
    createdAt: true,
    updatedAt: true,
  });

export type InsertProfessionalProject = typeof professionalProjects.$inferInsert;
export type ProfessionalProjectRow = typeof professionalProjects.$inferSelect;
