/**
 * Shared request validation helpers.
 */

/**
 * Guards a path parameter before it reaches a uuid column. Passing a malformed
 * id to a uuid comparison raises a Postgres type error, which would surface as
 * an opaque 500 instead of a clean 404.
 */
export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}
