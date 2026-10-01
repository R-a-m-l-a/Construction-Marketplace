import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Phase 6A materials suppliers.
 *
 * A supplier is a **separate entity** from `professionals`, by decision: a
 * trade professional and a materials shop are different concepts, and
 * overloading one would have contaminated the Phase 5B professional discovery
 * and its public read model. Phase 6A stores the supplier record and links
 * products to it; supplier pages and supplier-owned CRUD arrive in 6B.
 *
 * No ratings, reviews, verification, experience, analytics, lead scores,
 * subscriptions or payments. `phone` and `whatsapp` are stored here so the
 * contact actions planned for 6C have a real source, but nothing renders them
 * in 6A.
 *
 * `clerkUserId` is nullable because self-service supplier onboarding is not
 * part of 6A; it is unique so the 6B/6C ownership model can reuse the
 * established Clerk -> row pattern without a migration.
 */
export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id"),
    name: text("name").notNull(),
    description: text("description"),
    city: text("city").notNull(),
    location: text("location"),
    logoUrl: text("logo_url"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Postgres allows many NULLs in a unique index, so unowned suppliers are
    // fine while an owned one can only exist once.
    uniqueIndex("suppliers_clerk_user_id_unique").on(table.clerkUserId),
    index("suppliers_city_idx").on(table.city),
  ],
);

export type SupplierRow = typeof suppliers.$inferSelect;
