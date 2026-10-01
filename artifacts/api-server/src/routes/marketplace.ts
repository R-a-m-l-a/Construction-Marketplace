import { and, asc, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { Router, type IRouter, type Request } from "express";
import {
  CreateSupplierQuoteRequestBody,
  CreateSupplierQuoteRequestResponse,
  GetPublicProductResponse,
  GetPublicSupplierResponse,
  isAllowedLogoUrl,
  ListCategoriesResponse,
  ListMySupplierQuoteRequestsResponse,
  ListProductsResponse,
  ListFeaturedProductsResponse,
  LOGO_URL_ERROR_MESSAGE,
} from "@workspace/api-zod";
import {
  categories,
  products,
  suppliers,
  supplierQuoteRequests,
  type SupplierQuoteRequestRow,
} from "@workspace/db/schema";
import {
  containsPattern,
  presentFields,
  queryString,
  rankByTypo,
  searchTokens,
} from "../lib/search";
import { isUuid } from "../lib/validation";

const router: IRouter = Router();

/**
 * Discovery caps, matching the professional listing approach. These are bounds,
 * not pagination.
 */
const PUBLIC_PRODUCT_LIMIT = 100;
const FEATURED_PRODUCT_LIMIT = 6;
const CATEGORY_LIMIT = 100;
const SUPPLIER_PRODUCT_LIMIT = 100;

/** A product plus the joined names the public listing and search need. */
type PublicProductRow = {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  price: string | null;
  city: string;
  location: string | null;
  imageUrl: string | null;
  featured: boolean;
  createdAt: Date;
  supplierId: string;
  supplierName: string;
  supplierCity: string;
  supplierLocation: string | null;
  categoryId: string;
  categoryName: string;
};

function productSelection() {
  return {
    id: products.id,
    name: products.name,
    description: products.description,
    unit: products.unit,
    price: products.price,
    city: products.city,
    location: products.location,
    imageUrl: products.imageUrl,
    featured: products.featured,
    createdAt: products.createdAt,
    supplierId: products.supplierId,
    supplierName: suppliers.name,
    supplierCity: suppliers.city,
    supplierLocation: suppliers.location,
    categoryId: products.categoryId,
    categoryName: categories.name,
  };
}

/**
 * Public product read model. `supplier` and `category` are the joined names
 * rather than opaque ids, which is what the existing ProductPreview consumers
 * expect, while the ids remain available for the structured filters.
 *
 * Price is converted once here: Postgres `numeric` is exact and Drizzle
 * surfaces it as a string. Null means "Price on request" and is never invented.
 */
function serializeProduct(row: PublicProductRow) {
  const price = row.price === null ? null : Number(row.price);
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    unit: row.unit ?? null,
    price: price !== null && Number.isFinite(price) ? price : null,
    category: row.categoryName,
    categoryId: row.categoryId,
    supplier: row.supplierName,
    supplierId: row.supplierId,
    city: row.city,
    location: row.location ?? null,
    imageUrl: row.imageUrl ?? null,
    priceLabel: price === null ? "Price on request" : null,
    featured: row.featured,
  };
}

function authenticatedUserId(req: Request) {
  return getAuth(req).userId;
}

/**
 * Public supplier read model.
 *
 * `phone` and `whatsapp` are intentionally included from Phase 6C so the
 * WhatsApp and Call actions can open the supplier's real stored number. The
 * frontend renders neither action when the value is absent, so an incomplete
 * supplier simply shows fewer actions rather than a broken one. `clerkUserId`
 * and every other ownership field are never selected, so they cannot leak.
 */
function serializePublicSupplier(row: {
  id: string;
  name: string;
  description: string | null;
  city: string;
  location: string | null;
  logoUrl: string | null;
  phone: string | null;
  whatsapp: string | null;
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    city: row.city,
    location: row.location ?? null,
    logoUrl: row.logoUrl ?? null,
    phone: row.phone ?? null,
    whatsapp: row.whatsapp ?? null,
  };
}

function serializeSupplierQuoteRequest(row: SupplierQuoteRequestRow) {
  return {
    id: row.id,
    productId: row.productId ?? null,
    name: row.name,
    email: row.email,
    size: row.size,
    details: row.details,
    imageUrls: Array.isArray(row.imageUrls) ? row.imageUrls : [],
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * The joined row behind the single-product page: the product fields plus the
 * public supplier and category columns needed for the nested response objects.
 */
type PublicProductDetailRow = Pick<
  PublicProductRow,
  | "id"
  | "name"
  | "description"
  | "unit"
  | "price"
  | "city"
  | "location"
  | "imageUrl"
  | "featured"
  | "createdAt"
  | "categoryId"
  | "categoryName"
  | "supplierId"
  | "supplierName"
  | "supplierCity"
  | "supplierLocation"
> & {
  supplierDescription: string | null;
  supplierLogoUrl: string | null;
  supplierPhone: string | null;
  supplierWhatsapp: string | null;
};

/**
 * Product shape for the single-product public page. It deliberately omits the
 * joined supplier/category names, because those are returned as their own
 * nested objects on that response instead of being duplicated here.
 */
function serializeProductDetail(row: PublicProductDetailRow) {
  const price = row.price === null ? null : Number(row.price);
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    unit: row.unit ?? null,
    price: price !== null && Number.isFinite(price) ? price : null,
    priceLabel: price === null ? "Price on request" : null,
    city: row.city,
    location: row.location ?? null,
    imageUrl: row.imageUrl ?? null,
    featured: row.featured,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The values a free-text product search may match, entity-specific by design. */
function productSearchFields(row: PublicProductRow): string[] {
  return presentFields([
    row.name,
    row.description,
    row.unit,
    row.supplierName,
    row.categoryName,
    row.city,
    row.location,
    // The supplier's own area and city, so searching an area such as "Gulberg"
    // finds that supplier's materials.
    row.supplierCity,
    row.supplierLocation,
  ]);
}

type ProductFilters = {
  query?: string;
  category?: string;
  city?: string;
  supplier?: string;
};

function productFilters(req: Request): ProductFilters {
  return {
    query: queryString(req.query.query),
    category: queryString(req.query.category),
    city: queryString(req.query.city),
    supplier: queryString(req.query.supplier),
  };
}

/**
 * Structured facets. `category` and `supplier` are id equality, so they are
 * never fuzzed. `city` stays a predictable case-insensitive substring.
 */
function structuredProductFilters(filters: ProductFilters): SQL | undefined {
  const conditions: SQL[] = [];

  const category = filters.category?.trim();
  if (category) conditions.push(eq(products.categoryId, category));

  const supplier = filters.supplier?.trim();
  if (supplier) conditions.push(eq(products.supplierId, supplier));

  const city = filters.city?.trim();
  if (city) conditions.push(ilike(products.city, containsPattern(city)));

  return conditions.length > 0 ? and(...conditions) : undefined;
}

/**
 * Free-text search across the joined public fields, using the same tokenised
 * multi-word behaviour as professional discovery.
 */
function productSearchFilter(term: string): SQL | undefined {
  const conditions: SQL[] = [];

  for (const token of searchTokens(term)) {
    const pattern = containsPattern(token);
    const tokenMatch = or(
      ilike(products.name, pattern),
      ilike(products.description, pattern),
      ilike(products.unit, pattern),
      ilike(suppliers.name, pattern),
      ilike(suppliers.city, pattern),
      ilike(suppliers.location, pattern),
      ilike(categories.name, pattern),
      ilike(products.city, pattern),
      ilike(products.location, pattern),
    );
    if (tokenMatch) conditions.push(tokenMatch);
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

/**
 * Rejects a malformed uuid in a structured id filter explicitly, rather than
 * letting Postgres raise a type error that would surface as an opaque 500.
 */
function hasInvalidFilterId(filters: ProductFilters): boolean {
  for (const value of [filters.category, filters.supplier]) {
    const trimmed = value?.trim();
    if (trimmed && !isUuid(trimmed)) return true;
  }
  return false;
}

router.get("/categories", async (req, res): Promise<void> => {
  try {
    const { db } = await import("@workspace/db");
    const rows = await db
      .select({
        id: categories.id,
        name: categories.name,
        description: categories.description,
      })
      .from(categories)
      .orderBy(asc(categories.name))
      .limit(CATEGORY_LIMIT);

    res.json(
      ListCategoriesResponse.parse(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description ?? null,
        })),
      ),
    );
  } catch (error) {
    req.log.error({ err: error }, "Unable to load marketplace categories");
    res.status(500).json({ error: "Unable to load categories. Please try again." });
  }
});

router.get("/products", async (req, res): Promise<void> => {
  const filters = productFilters(req);
  if (hasInvalidFilterId(filters)) {
    res.status(400).json({ error: "That category or supplier id is not valid." });
    return;
  }

  try {
    const { db } = await import("@workspace/db");
    const term = filters.query?.trim() ?? "";
    const structured = structuredProductFilters(filters);
    const search = term ? productSearchFilter(term) : undefined;

    const select = (extra: SQL | undefined) => {
      const conditions = [structured, extra].filter(
        (condition): condition is SQL => condition !== undefined,
      );
      const combined = conditions.length > 0 ? and(...conditions) : undefined;
      const base = db
        .select(productSelection())
        .from(products)
        .innerJoin(suppliers, eq(products.supplierId, suppliers.id))
        .innerJoin(categories, eq(products.categoryId, categories.id));
      const filtered = combined ? base.where(combined) : base;
      return filtered
        .orderBy(desc(products.createdAt))
        .limit(PUBLIC_PRODUCT_LIMIT);
    };

    let rows = (await select(search)) as PublicProductRow[];

    // Typo tolerance only when the substring search matched nothing, so exact
    // and normal substring results are returned untouched. Candidates still
    // respect the structured filters, which are never fuzzed.
    if (rows.length === 0 && term) {
      const candidates = (await select(undefined)) as PublicProductRow[];
      rows = rankByTypo(candidates, searchTokens(term), productSearchFields);
    }

    res.json(ListProductsResponse.parse(rows.map(serializeProduct)));
  } catch (error) {
    req.log.error({ err: error }, "Unable to load marketplace products");
    res.status(500).json({ error: "Unable to load products. Please try again." });
  }
});

// Declared before "/products/:id" so the literal path always wins: ":id" would
// otherwise capture "featured" and reject it as a malformed uuid.
router.get("/products/featured", async (req, res): Promise<void> => {
  try {
    const { db } = await import("@workspace/db");
    const rows = (await db
      .select(productSelection())
      .from(products)
      .innerJoin(suppliers, eq(products.supplierId, suppliers.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.featured, true))
      .orderBy(desc(products.createdAt))
      .limit(FEATURED_PRODUCT_LIMIT)) as PublicProductRow[];

    res.json(ListFeaturedProductsResponse.parse(rows.map(serializeProduct)));
  } catch (error) {
    req.log.error({ err: error }, "Unable to load featured products");
    res
      .status(500)
      .json({ error: "Unable to load featured products. Please try again." });
  }
});

// Declared before "/suppliers/:id" so the literal path always wins.
router.get("/suppliers/me/quotes", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to view your quote requests." });
    return;
  }

  try {
    const { db } = await import("@workspace/db");
    // Ownership comes from the Clerk session through the supplier row. A client
    // can never ask for another supplier's requests, and an account with no
    // supplier simply has none rather than one being created automatically.
    const [supplier] = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(eq(suppliers.clerkUserId, userId))
      .limit(1);

    if (!supplier) {
      res.status(404).json({ error: "No supplier profile found." });
      return;
    }

    const rows = await db
      .select()
      .from(supplierQuoteRequests)
      .where(eq(supplierQuoteRequests.supplierId, supplier.id))
      .orderBy(desc(supplierQuoteRequests.createdAt));

    res.json(
      ListMySupplierQuoteRequestsResponse.parse(rows.map(serializeSupplierQuoteRequest)),
    );
  } catch (error) {
    req.log.error({ err: error }, "Unable to load supplier quote requests");
    res.status(500).json({ error: "Unable to load your quote requests." });
  }
});

router.post("/suppliers/:id/quote", async (req, res): Promise<void> => {
  if (!isUuid(req.params.id)) {
    res.status(400).json({ error: "That supplier id is not valid." });
    return;
  }

  const parsed = CreateSupplierQuoteRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the quote request you sent." });
    return;
  }

  const imageUrls = parsed.data.imageUrls ?? [];
  for (const candidate of imageUrls) {
    // Defense in depth. The shared validator already rejected anything unsafe
    // when the body was parsed; this reuses the same predicate rather than
    // re-implementing the protocol allowlist.
    if (!isAllowedLogoUrl(candidate)) {
      res.status(400).json({ error: LOGO_URL_ERROR_MESSAGE });
      return;
    }
  }

  // An optional product association. Rejected as a client input error rather
  // than a lookup failure, so a bad id never reveals whether it exists.
  const rawProductId = parsed.data.productId?.trim();
  if (rawProductId && !isUuid(rawProductId)) {
    res.status(400).json({ error: "That product id is not valid." });
    return;
  }

  try {
    const { db } = await import("@workspace/db");
    // Confirms the supplier exists before writing, so a request can never
    // become an orphan.
    const [supplier] = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(eq(suppliers.id, req.params.id))
      .limit(1);

    if (!supplier) {
      res.status(404).json({ error: "No such supplier." });
      return;
    }

    let productId: string | null = null;
    if (rawProductId) {
      // The product must exist and belong to the supplier in the URL, so a
      // quote can never be attached across two different suppliers.
      const [product] = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.id, rawProductId), eq(products.supplierId, supplier.id)))
        .limit(1);

      if (!product) {
        res.status(400).json({
          error: "That product does not belong to this supplier.",
        });
        return;
      }
      productId = product.id;
    }

    const [created] = await db
      .insert(supplierQuoteRequests)
      .values({
        supplierId: supplier.id,
        productId,
        name: parsed.data.name.trim(),
        email: parsed.data.email.trim(),
        size: parsed.data.size.trim(),
        details: parsed.data.details.trim(),
        imageUrls: imageUrls.map((candidate) => candidate.trim()),
      })
      .returning();

    if (!created) {
      res.status(500).json({ error: "Unable to send your request." });
      return;
    }

    res
      .status(201)
      .json(CreateSupplierQuoteRequestResponse.parse(serializeSupplierQuoteRequest(created)));
  } catch (error) {
    req.log.error({ err: error }, "Unable to create supplier quote request");
    res.status(500).json({ error: "Unable to send your request." });
  }
});

router.get("/products/:id", async (req, res): Promise<void> => {
  if (!isUuid(req.params.id)) {
    res.status(400).json({ error: "That product id is not valid." });
    return;
  }

  try {
    const { db } = await import("@workspace/db");
    const [row] = (await db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        unit: products.unit,
        price: products.price,
        city: products.city,
        location: products.location,
        imageUrl: products.imageUrl,
        featured: products.featured,
        createdAt: products.createdAt,
        categoryId: categories.id,
        categoryName: categories.name,
        supplierId: suppliers.id,
        supplierName: suppliers.name,
        supplierDescription: suppliers.description,
        supplierCity: suppliers.city,
        supplierLocation: suppliers.location,
        supplierLogoUrl: suppliers.logoUrl,
        supplierPhone: suppliers.phone,
        supplierWhatsapp: suppliers.whatsapp,
      })
      .from(products)
      .innerJoin(suppliers, eq(products.supplierId, suppliers.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.id, req.params.id))
      .limit(1)) as unknown as PublicProductDetailRow[];

    if (!row) {
      res.status(404).json({ error: "No such product." });
      return;
    }

    res.json(
      GetPublicProductResponse.parse({
        product: serializeProductDetail(row),
        category: {
          id: row.categoryId as string,
          name: row.categoryName as string,
        },
        // Explicit public shape: clerkUserId is never selected here, so it
        // cannot leak even accidentally. phone/whatsapp are public from 6C.
        supplier: serializePublicSupplier({
          id: row.supplierId as string,
          name: row.supplierName as string,
          description: row.supplierDescription as string | null,
          city: row.supplierCity as string,
          location: row.supplierLocation as string | null,
          logoUrl: row.supplierLogoUrl as string | null,
          phone: row.supplierPhone as string | null,
          whatsapp: row.supplierWhatsapp as string | null,
        }),
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Unable to load marketplace product");
    res.status(500).json({ error: "Unable to load this product. Please try again." });
  }
});

router.get("/suppliers/:id", async (req, res): Promise<void> => {
  if (!isUuid(req.params.id)) {
    res.status(400).json({ error: "That supplier id is not valid." });
    return;
  }

  try {
    const { db } = await import("@workspace/db");
    const [supplier] = await db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        description: suppliers.description,
        city: suppliers.city,
        location: suppliers.location,
        logoUrl: suppliers.logoUrl,
        phone: suppliers.phone,
        whatsapp: suppliers.whatsapp,
      })
      .from(suppliers)
      .where(eq(suppliers.id, req.params.id))
      .limit(1);

    if (!supplier) {
      res.status(404).json({ error: "No such supplier." });
      return;
    }

    const rows = (await db
      .select(productSelection())
      .from(products)
      .innerJoin(suppliers, eq(products.supplierId, suppliers.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.supplierId, supplier.id))
      .orderBy(desc(products.createdAt))
      .limit(SUPPLIER_PRODUCT_LIMIT)) as PublicProductRow[];

    res.json(
      GetPublicSupplierResponse.parse({
        // Explicit public shape: clerkUserId is never selected, so it cannot
        // leak even accidentally.
        supplier: serializePublicSupplier({
          id: supplier.id,
          name: supplier.name,
          description: supplier.description,
          city: supplier.city,
          location: supplier.location,
          logoUrl: supplier.logoUrl,
          phone: supplier.phone,
          whatsapp: supplier.whatsapp,
        }),
        // Reuses the same public product shape as the marketplace listing, so a
        // supplier's products render through the identical card.
        products: rows.map(serializeProduct),
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Unable to load marketplace supplier");
    res.status(500).json({ error: "Unable to load this supplier. Please try again." });
  }
});

export default router;
