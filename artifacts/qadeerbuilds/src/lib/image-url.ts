/**
 * Instant client-side mirror of the shared server rule in
 * `lib/api-zod/src/shared/logo-url.ts` (isAllowedLogoUrl). The browser bundle
 * cannot import the server validation package, so this exists purely to give
 * fast feedback; the authoritative check is the shared validator, which the API
 * applies to every body carrying a logo or portfolio image URL.
 *
 * It lives in its own module so the professional profile form and the Phase 5C
 * portfolio editor share exactly one copy of the rule instead of drifting.
 */
export const PROFESSIONAL_IMAGE_URL_MAX_LENGTH = 2048;

export function isAllowedImageUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.length > PROFESSIONAL_IMAGE_URL_MAX_LENGTH) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
