import { createInsertSchema } from "drizzle-zod";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const professionals = pgTable(
  "professionals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    name: text("name").notNull(),
    profession: text("profession").notNull(),
    category: text("category").notNull(),
    services: text("services").notNull(),
    bio: text("bio"),
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
    uniqueIndex("professionals_clerk_user_id_unique").on(table.clerkUserId),
    index("professionals_city_idx").on(table.city),
  ],
);

export const insertProfessionalSchema = createInsertSchema(professionals).omit({
  id: true,
  clerkUserId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProfessional = typeof professionals.$inferInsert;
export type ProfessionalRow = typeof professionals.$inferSelect;
