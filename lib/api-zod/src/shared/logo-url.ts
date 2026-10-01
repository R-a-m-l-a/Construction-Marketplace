import { z } from "zod";

/**
 * Single source of truth for professional logo/profile image references.
 *
 * Phase 5A stores an image *URL* only; there is no upload endpoint. The rule
 * is deliberately implemented with URL parsing plus an explicit protocol
 * allowlist instead of a `^https?://` regex, because a loose pattern can be
 * mangled by the OpenAPI generator and would not reject a scheme such as
 * `javascript:` that still parses as an absolute URL.
 */
export const LOGO_URL_MAX_LENGTH = 2048;

const ALLOWED_LOGO_URL_PROTOCOLS: ReadonlySet<string> = new Set([
  "http:",
  "https:",
]);

export const LOGO_URL_ERROR_MESSAGE =
  "Logo must be an absolute http or https image URL.";

type ParsedUrlLike = { protocol: string };

/**
 * Uses the runtime WHATWG `URL` parser (available in Node 18+ and browsers).
 * This package compiles with `lib: ["es2022"]` and no ambient DOM/Node types,
 * so the constructor is looked up explicitly instead of widening the tsconfig
 * or adding a dependency. If it is ever unavailable we fail closed and reject.
 */
function parseAbsoluteUrl(value: string): ParsedUrlLike | null {
  const UrlConstructor = (globalThis as { URL?: new (input: string) => ParsedUrlLike })
    .URL;
  if (typeof UrlConstructor !== "function") return null;

  try {
    return new UrlConstructor(value);
  } catch {
    return null;
  }
}

/**
 * Returns true only for an absolute http(s) URL. An empty or whitespace-only
 * value is accepted so callers can clear an optional image by submitting "".
 *
 * Rejected: javascript:, data:, file:, ftp:, any other scheme, relative paths
 * ("/image.png"), protocol-relative paths ("//example.com/image.png") and
 * arbitrary non-URL text.
 */
export function isAllowedLogoUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.length > LOGO_URL_MAX_LENGTH) return false;

  const parsed = parseAbsoluteUrl(trimmed);
  if (!parsed) return false;

  return ALLOWED_LOGO_URL_PROTOCOLS.has(parsed.protocol);
}

export const logoUrlSchema = z
  .string()
  .max(LOGO_URL_MAX_LENGTH, `Logo URL must be ${LOGO_URL_MAX_LENGTH} characters or fewer.`)
  .refine(isAllowedLogoUrl, { message: LOGO_URL_ERROR_MESSAGE });
