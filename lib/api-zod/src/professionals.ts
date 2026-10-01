import {
  CreateProfessionalBody as GeneratedCreateProfessionalBody,
  UpdateMyProfessionalBody as GeneratedUpdateMyProfessionalBody,
} from "./generated/api";
import { logoUrlSchema } from "./shared/logo-url";

/**
 * The generated bodies describe the transport shape. These refinements layer
 * the shared logo URL rule on top of that shape so every server consumer of
 * `@workspace/api-zod` validates the same way, instead of each route
 * re-implementing the protocol check.
 *
 * Field optionality and null behaviour are unchanged: the field stays
 * optional, and an empty string is still accepted (and treated as "no logo").
 */
export const CreateProfessionalBody = GeneratedCreateProfessionalBody.extend({
  logoUrl: logoUrlSchema.optional(),
});

export const UpdateMyProfessionalBody =
  GeneratedUpdateMyProfessionalBody.extend({
    logoUrl: logoUrlSchema.optional(),
  });
