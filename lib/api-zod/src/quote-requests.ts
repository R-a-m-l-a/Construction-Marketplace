import { CreateProfessionalQuoteRequestBody as GeneratedCreateQuoteRequestBody } from "./generated/api";
import { logoUrlSchema } from "./shared/logo-url";

/**
 * Phase 5D "Get a Quote".
 *
 * The generated body carries the transport shape and the `format: email` rule.
 * This refinement layers the shared image URL rule on every entry of
 * `imageUrls` so a visitor-supplied reference image is validated exactly like a
 * professional logo or a portfolio image. There is no second URL policy to keep
 * in sync, and `javascript:`, `data:`, relative and protocol-relative values
 * are all rejected.
 *
 * The array itself stays optional and capped at five by the generated schema.
 */
export const CreateQuoteRequestBody = GeneratedCreateQuoteRequestBody.extend({
  imageUrls: logoUrlSchema.array().max(5).optional(),
});
