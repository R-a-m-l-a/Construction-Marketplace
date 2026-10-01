import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { products } from "./products";
import { suppliers } from "./suppliers";

/**
 * Phase 6C "Get a Quote" for a materials supplier.
 *
 * Deliberately a **separate table** from `professional_quote_requests`: a
 * material enquiry and a trade-professional enquiry are different records with
 * different owners, and merging them into one table with two nullable foreign
 * keys would allow a row that belongs to neither (or both). One owner, one row.
 *
 * `supplierId` is the owner and cascades with the supplier. `productId` is an
 * optional pointer to the material the visitor was looking at, and uses
 * ON DELETE SET NULL so a removed product keeps the enquiry itself intact
 * rather than deleting the visitor's message.
 *
 * `imageUrls` stores links only, validated with the same rule as a
 * professional logo or a portfolio image. There is no file upload anywhere in
 * this project.
 *
 * No status, budget, deadline, priority, assignment, messaging, payment, order,
 * cart or analytics fields: this is a received-request list, not a CRM.
 */
export const supplierQuoteRequests = pgTable(
  "supplier_quote_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    size: text("size").notNull(),
    details: text("details").notNull(),
    imageUrls: jsonb("image_urls")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Every read of this table is scoped to one supplier.
    index("supplier_quote_requests_supplier_id_idx").on(table.supplierId),
  ],
);

export type InsertSupplierQuoteRequest =
  typeof supplierQuoteRequests.$inferInsert;
export type SupplierQuoteRequestRow =
  typeof supplierQuoteRequests.$inferSelect;