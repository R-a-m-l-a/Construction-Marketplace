/**
 * Entity-agnostic public-discovery search helpers.
 *
 * Extracted from the Phase 5B professional discovery route so the Phase 6A
 * product listing can run the *same* search instead of maintaining a second,
 * weaker copy. Nothing entity-specific lives here: each route decides which of
 * its own fields are searchable, and structured (id-based) facets are never
 * fuzzed.
 *
 * Behaviour is unchanged from the original 5B implementation.
 */

/**
 * Reads a single query-string value, mirroring the convention already used by
 * the location routes. Repeated or array values collapse to the first entry.
 */
export function queryString(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
}

/**
 * Builds an ILIKE pattern for a case-insensitive "contains" match. The value is
 * always sent as a bound parameter, and LIKE metacharacters typed by the user
 * are escaped so a literal `%` or `_` cannot widen the match.
 */
export function containsPattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}

/** Splits a free-text term into lower-cased word tokens. */
export function searchTokens(term: string): string[] {
  return term.toLowerCase().split(/\s+/).filter(Boolean);
}

// Typo tolerance for the free-text search. Deliberately small and dependency
// free: Damerau-Levenshtein over the words of the public fields, with a
// tolerance that grows with the length of the typed token so short queries
// cannot start matching unrelated records.
const FUZZY_MIN_TOKEN_LENGTH = 4;

/**
 * Damerau-Levenshtein (optimal string alignment), dependency free. Plain
 * Levenshtein scores an adjacent swap such as "Desgin" -> "Design" as two
 * edits, which is the most common human typo, so transpositions are counted
 * as one here.
 */
export function editDistance(first: string, second: string): number {
  if (first === second) return 0;
  if (first.length === 0) return second.length;
  if (second.length === 0) return first.length;

  let twoBack: number[] = [];
  let previous = Array.from({ length: second.length + 1 }, (_, index) => index);

  for (let row = 1; row <= first.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= second.length; column += 1) {
      const substitution =
        previous[column - 1] + (first[row - 1] === second[column - 1] ? 0 : 1);
      let value = Math.min(
        substitution,
        previous[column] + 1,
        current[column - 1] + 1,
      );
      if (
        row > 1 &&
        column > 1 &&
        first[row - 1] === second[column - 2] &&
        first[row - 2] === second[column - 1]
      ) {
        value = Math.min(value, twoBack[column - 2] + 1);
      }
      current[column] = value;
    }
    twoBack = previous;
    previous = current;
  }
  return previous[second.length];
}

/**
 * How much spelling drift one typed token may have. Short tokens are never
 * fuzzed so a brief query cannot drag in unrelated records, and the allowance
 * is capped at two edits so a long word does not absorb arbitrary extra
 * characters (for example "architectxyz" against "architect").
 */
export function typoTolerance(length: number): number {
  if (length < FUZZY_MIN_TOKEN_LENGTH) return 0;
  return length <= 6 ? 1 : 2;
}

/** Keeps only non-empty strings, for a record's searchable field values. */
export function presentFields(values: unknown[]): string[] {
  return values.filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

/** Splits a record's searchable field values into comparable words. */
export function searchableWords(fields: string[]): string[] {
  return fields
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/))
    .filter(Boolean);
}

/**
 * Total typo distance between one record's searchable fields and the search
 * tokens, or null when the record is not a reasonable match. Every token must
 * be accounted for, so a two-word query cannot match on one strong word alone.
 *
 * Runs in memory over already-fetched rows, so no user text ever reaches SQL.
 */
export function typoDistance(
  fields: string[],
  words: string[],
  tokens: string[],
): number | null {
  let total = 0;
  for (const token of tokens) {
    // A token that already appears verbatim costs nothing.
    if (fields.some((field) => field.toLowerCase().includes(token))) continue;

    const tolerance = typoTolerance(token.length);
    if (tolerance === 0) return null;

    let best = Number.POSITIVE_INFINITY;
    for (const word of words) {
      const distance = editDistance(token, word);
      if (distance < best) best = distance;
    }
    if (!Number.isFinite(best) || best > tolerance) return null;

    total += best;
  }
  return total;
}

/**
 * Ranks rows that pass the structured filters by how close their searchable
 * fields are to the query tokens, closest first. Used only as a fallback when
 * the substring search matched nothing.
 */
export function rankByTypo<T>(
  rows: T[],
  tokens: string[],
  getFields: (row: T) => string[],
): T[] {
  return rows
    .map((row) => {
      const fields = presentFields(getFields(row));
      return {
        row,
        distance: typoDistance(fields, searchableWords(fields), tokens),
      };
    })
    .filter(
      (entry): entry is { row: T; distance: number } => entry.distance !== null,
    )
    .sort((first, second) => first.distance - second.distance)
    .map((entry) => entry.row);
}
