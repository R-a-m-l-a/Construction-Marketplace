import {
  boolean,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { categories } from "./categories";
import { suppliers } from "./suppliers";

/**
 * Phase 6A marketplace products.
 *
 * A product belongs to exactly one supplier and exactly one category, and
 * carries the material-specific fields a discovery listing needs.
 *
 * `price` is a nullable numeric PKR amount. Null means "Price on request" and
 * is rendered as such, which is honest: no price is ever invented. Because
 * Postgres `numeric` is exact, Drizzle surfaces it as a string and the API
 * converts it once at the read boundary.
 *
 * `featured` is a plain boolean flag for the homepage preview, not a ranking.
 *
 * No inventory, stock tracking, cart, orders, reviews, ratings, payments or
 * subscriptions.
 */
export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    unit: text("unit"),
    price: numeric("price", { precision: 12, scale: 2 }),
    city: text("city").notNull(),
    location: text("location"),
    imageUrl: text("image_url"),
    featured: boolean("featured").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("products_supplier_id_idx").on(table.supplierId),
    index("products_category_id_idx").on(table.categoryId),
    index("products_city_idx").on(table.city),
    index("products_featured_idx").on(table.featured),
  ],
);

export type ProductRow = typeof products.$inferSelect;
