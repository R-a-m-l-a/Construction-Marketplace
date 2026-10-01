import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Phase 6A marketplace category catalogue.
 *
 * The authoritative category source for the marketplace. It replaces the
 * hard-coded arrays that previously lived in the discovery route and in the
 * frontend, so there is exactly one source of truth.
 *
 * Deliberately flat. A nullable `parentId` is intentionally NOT modelled in
 * 6A: nothing in the verified scope or the current schema needs a
 * subcategory hierarchy yet, and it can be added as a non-breaking column
 * later.
 */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // The marketplace category filter joins on the name, and the public list is
    // ordered by it.
    index("categories_name_idx").on(table.name),
  ],
);

export type CategoryRow = typeof categories.$inferSelect;
