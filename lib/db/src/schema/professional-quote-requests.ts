import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { professionals } from "./professionals";

/**
 * Phase 5D "Get a Quote".
 *
 * One visitor-submitted request, attached to the professional whose public
 * profile was being viewed. Deliberately minimal and matching the verified
 * Tameer flow exactly: who to reply to, how big the job is, what it involves,
 * and up to five reference image links.
 *
 * There is no status, budget, deadline, priority, assignment, chat or payment
 * field: this is a received-request list, not a CRM. A request is removed by
 * cascade if the professional is ever deleted.
 *
 * `imageUrls` stores links only, using the same rule as the professional logo
 * and portfolio images. There is no file upload anywhere in this project.
 */
export const professionalQuoteRequests = pgTable(
  "professional_quote_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
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
    // Every read of this table is scoped to one professional.
    index("professional_quote_requests_professional_id_idx").on(table.professionalId),
  ],
);

export type InsertProfessionalQuoteRequest =
  typeof professionalQuoteRequests.$inferInsert;
export type ProfessionalQuoteRequestRow =
  typeof professionalQuoteRequests.$inferSelect;
