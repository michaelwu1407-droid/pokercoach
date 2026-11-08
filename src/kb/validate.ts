import type { Concept } from "../learn/concepts";
import { isPredicateId, type PredicateId } from "../learn/spot";
import { type Chunk, normalise } from "./chunk";

/** What the extractor proposes for one chunk, before any checks. */
export interface Candidate {
  readonly title: string;
  readonly statement: string;
  /** Must appear word for word in the chunk. */
  readonly quote: string;
  readonly appliesWhen: readonly string[];
}

export interface CheckedCandidate {
  readonly id: string;
  readonly chunkId: string;
  readonly location: string;
  readonly title: string;
  readonly statement: string;
  readonly quote: string;
  readonly appliesWhen: readonly PredicateId[];
}

export type Rejection = { readonly title: string; readonly reason: string };

const loose = (s: string) => normalise(s).toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

/**
 * The guard against invented teaching. A candidate survives only if its quote is really in the
 * chunk and every situation test it names exists.
 */
export function check(c: Candidate, chunk: Chunk, bookId: string): CheckedCandidate | Rejection {
  if (c.quote.trim().length < 20) return { title: c.title, reason: "quote too short to stand as evidence" };
  if (!loose(chunk.text).includes(loose(c.quote))) return { title: c.title, reason: "quote not found in the source text" };
  const unknown = c.appliesWhen.filter((p) => !isPredicateId(p));
  if (unknown.length) return { title: c.title, reason: `unknown situation tests: ${unknown.join(", ")}` };
  if (c.appliesWhen.length === 0) return { title: c.title, reason: "names no situation it applies to" };
  return {
    id: `${bookId}:${slug(c.title)}`, chunkId: chunk.id, location: chunk.location,
    title: c.title.trim(), statement: c.statement.trim(), quote: normalise(c.quote),
    appliesWhen: c.appliesWhen.filter(isPredicateId),
  };
}

export const isRejection = (x: CheckedCandidate | Rejection): x is Rejection => "reason" in x;

export function toConcept(c: CheckedCandidate, bookTitle: string): Concept {
  return {
    id: c.id, title: c.title, statement: c.statement, prerequisites: [], appliesWhen: c.appliesWhen, graded: false,
    sources: [{ kind: "book", book: bookTitle, location: c.location, quote: c.quote }],
  };
}
