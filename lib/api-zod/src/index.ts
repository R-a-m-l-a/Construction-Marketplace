export * from "./generated/api";
// Explicit re-exports intentionally shadow the generated equivalents so that
// the shared logo URL rule is applied at the contract level.
export { CreateProfessionalBody, UpdateMyProfessionalBody } from "./professionals";
export {
  CreateProfessionalProjectBody,
  UpdateProfessionalProjectBody,
} from "./professional-projects";
export { CreateQuoteRequestBody } from "./quote-requests";
export { CreateSupplierQuoteRequestBody } from "./supplier-quote-requests";
export {
  isAllowedLogoUrl,
  LOGO_URL_ERROR_MESSAGE,
  LOGO_URL_MAX_LENGTH,
  logoUrlSchema,
} from "./shared/logo-url";
export type { CreateConstructionEstimateBody as CreateConstructionEstimateBodyType } from "./generated/types/createConstructionEstimateBody";
// Orval re-adds `export * from './generated/types'` on every codegen run. It
// collides with the explicit re-exports above (TS2308), so it is removed again
// after each generation.
