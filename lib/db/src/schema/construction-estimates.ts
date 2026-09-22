import { createInsertSchema } from "drizzle-zod";
import {
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const constructionEstimates = pgTable("construction_estimates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  location: text("location").notNull(),
  plotSize: numeric("plot_size", { precision: 12, scale: 2 }).notNull(),
  plotUnit: text("plot_unit").notNull(),
  plotAreaSqFt: integer("plot_area_sq_ft").notNull(),
  coveredAreaMode: text("covered_area_mode").notNull(),
  coveredAreaBasis: text("covered_area_basis").notNull(),
  coveredAreaValue: numeric("covered_area_value", {
    precision: 12,
    scale: 2,
  }).notNull(),
  floorCount: integer("floor_count").notNull(),
  floors: text("floors").notNull(),
  constructionType: text("construction_type").notNull(),
  quality: text("quality").notNull(),
  totalCoveredAreaSqFt: integer("total_covered_area_sq_ft").notNull(),
  greyMin: integer("grey_min").notNull(),
  greyMax: integer("grey_max").notNull(),
  finishingMin: integer("finishing_min").notNull(),
  finishingMax: integer("finishing_max").notNull(),
  estimatedMin: integer("estimated_min").notNull(),
  estimatedMax: integer("estimated_max").notNull(),
  costPerSqFtMin: integer("cost_per_sq_ft_min").notNull(),
  costPerSqFtMax: integer("cost_per_sq_ft_max").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const insertConstructionEstimateSchema = createInsertSchema(
  constructionEstimates,
).omit({
  id: true,
  createdAt: true,
});

export type InsertConstructionEstimate =
  typeof constructionEstimates.$inferInsert;
export type ConstructionEstimate = typeof constructionEstimates.$inferSelect;