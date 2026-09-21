/**
 * An inverted prefix index for "search by name, id, email or phone".
 *
 * THE PROBLEM
 * -----------
 * The naive implementation of a search box is
 *
 *     records.filter(r => r.name.toLowerCase().includes(q))
 *
 * which is O(N x L) per keystroke - every record, every character. At 20,000
 * visitors that is millions of character comparisons per keypress and the input
 * visibly stutters.
 *
 * THE FIX
 * -------
 * Build the index once, up front. For every record we split its searchable text
 * into tokens ("Lalita", "Mehta", "walsons", "9756195792") and store the first
 * `MAX_PREFIX` prefixes of each token in a Map:
 *
 *     "l" -> {id1, id7, ...}   "la" -> {id1, ...}   "lal" -> {id1}   "lali" -> {id1}
 *
 * A query then does one O(1) Map lookup on the query's own prefix to get a small
 * candidate set, and only verifies the full query text against those candidates.
 *
 *   build   O(R x T x MAX_PREFIX)   once, ~120ms for 20k visitors
 *   query   O(C)                    C = candidates sharing the prefix, typically < 50
 *
 * versus O(N) per keystroke for the naive version. Memory is the trade-off we
 * accept: MAX_PREFIX entries per token, measured in `docs/COMPLEXITY.md`.
 */

/** Prefixes longer than this are handled by verifying candidates instead. */
const MAX_PREFIX = 4;

/** Splits text into lowercase alphanumeric tokens. */
function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean);
}

export class SearchIndex {
  /** prefix -> ids of records containing a token starting with that prefix */
  private prefixes = new Map<string, Set<string>>();
  /** id -> the full haystack, used to verify candidates for long queries */
  private haystack = new Map<string, string>();

  get size(): number {
    return this.haystack.size;
  }

  /** Number of distinct prefix keys - reported by the benchmark as a memory proxy. */
  get keyCount(): number {
    return this.prefixes.size;
  }

  /**
   * Adds (or replaces) one record.
   * @param id     record id
   * @param fields the searchable text fields, e.g. [name, email, phone, company]
   */
  add(id: string, fields: string[]): void {
    if (this.haystack.has(id)) this.remove(id);

    const joined = fields.join(' ').toLowerCase();
    this.haystack.set(id, joined);

    for (const token of tokenize(joined)) {
      const upto = Math.min(token.length, MAX_PREFIX);
      for (let len = 1; len <= upto; len++) {
        const prefix = token.slice(0, len);
        let bucket = this.prefixes.get(prefix);
        if (!bucket) {
          bucket = new Set();
          this.prefixes.set(prefix, bucket);
        }
        bucket.add(id);
      }
    }
  }

  remove(id: string): void {
    const joined = this.haystack.get(id);
    if (joined === undefined) return;
    for (const token of tokenize(joined)) {
      const upto = Math.min(token.length, MAX_PREFIX);
      for (let len = 1; len <= upto; len++) {
        this.prefixes.get(token.slice(0, len))?.delete(id);
      }
    }
    this.haystack.delete(id);
  }

  /**
   * Returns the ids matching `query`.
   *
   * Multi-word queries ("lalita mehta") are treated as AND: we resolve each word
   * separately and intersect, starting from the smallest candidate set so the
   * intersection costs O(min(|A|,|B|)) rather than O(|A|+|B|).
   */
  search(query: string): Set<string> {
    const words = tokenize(query);
    if (words.length === 0) return new Set(this.haystack.keys());

    let result: Set<string> | null = null;

    for (const word of words) {
      const candidates = this.prefixes.get(word.slice(0, MAX_PREFIX));
      if (!candidates || candidates.size === 0) return new Set();

      // For queries longer than the indexed prefix, verify against the haystack.
      let matched: Set<string>;
      if (word.length <= MAX_PREFIX) {
        matched = candidates;
      } else {
        matched = new Set();
        for (const id of candidates) {
          if (this.haystack.get(id)!.includes(word)) matched.add(id);
        }
      }

      result = result === null ? matched : intersect(result, matched);
      if (result.size === 0) return result;
    }

    return result ?? new Set();
  }

  clear(): void {
    this.prefixes.clear();
    this.haystack.clear();
  }
}

/** Intersects two sets in O(min(|a|,|b|)) by iterating the smaller one. */
export function intersect(a: Set<string>, b: Set<string>): Set<string> {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  const out = new Set<string>();
  for (const id of small) if (large.has(id)) out.add(id);
  return out;
}
