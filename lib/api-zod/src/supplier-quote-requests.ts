import { CreateSupplierQuoteRequestBody as GeneratedCreateSupplierQuoteRequestBody } from "./generated/api";
import { logoUrlSchema } from "./shared/logo-url";

/**
 * Phase 6C "Get a Quote" for a materials supplier.
 *
 * The generated body carries the transport shape, the required fields and the
 * `format: email` rule. This refinement layers the shared image URL rule on
 * every entry of `imageUrls`, so a visitor-supplied reference image is
 * validated exactly like a professional logo, a portfolio image or a Phase 5D
 * quote image. There is no second URL policy to keep in sync, and
 * `javascript:`, `data:`, relative and protocol-relative values are all
 * rejected.
 *
 * `productId` stays a plain optional string here: it is a pointer into a
 * product owned by the supplier in the URL, so the route validates it as a uuid
 * and checks the relationship before writing.
 */
export const CreateSupplierQuoteRequestBody =
  GeneratedCreateSupplierQuoteRequestBody.extend({
    imageUrls: logoUrlSchema.array().max(5).optional(),
  });