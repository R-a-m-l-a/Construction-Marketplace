import {
  CreateMyProfessionalProjectBody as GeneratedCreateProfessionalProjectBody,
  UpdateMyProfessionalProjectBody as GeneratedUpdateProfessionalProjectBody,
} from "./generated/api";
import { logoUrlSchema } from "./shared/logo-url";

/**
 * Phase 5C portfolio projects. The generated bodies describe the transport
 * shape; these refinements layer the shared image URL rule on top so a project
 * image is validated exactly like a professional logo, with no second URL
 * policy to keep in sync.
 *
 * `logoUrlSchema` is reused as-is (same http/https-only rule, same 2048
 * character limit) because a project reference image is the same kind of
 * value: a link to an image, never an inline payload.
 */
export const CreateProfessionalProjectBody =
  GeneratedCreateProfessionalProjectBody.extend({
    imageUrl: logoUrlSchema.optional(),
  });

export const UpdateProfessionalProjectBody =
  GeneratedUpdateProfessionalProjectBody.extend({
    imageUrl: logoUrlSchema.optional(),
  });
