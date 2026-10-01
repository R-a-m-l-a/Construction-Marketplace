import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: [
    "./src/schema/construction-estimates.ts",
    "./src/schema/project-briefs.ts",
    "./src/schema/professionals.ts",
    "./src/schema/professional-projects.ts",
    "./src/schema/professional-quote-requests.ts",
    "./src/schema/categories.ts",
    "./src/schema/suppliers.ts",
    "./src/schema/products.ts",
    "./src/schema/supplier-quote-requests.ts",
  ],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
