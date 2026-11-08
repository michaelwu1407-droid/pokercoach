import { CORE_CONCEPTS, type Concept } from "../learn/concepts";
import { emptyLearner, type Learner } from "../learn/learner";
import { isPredicateId } from "../learn/spot";

const KEY = "pokercoach.learner.v1";

export function loadLearner(): Learner {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyLearner;
    const parsed = JSON.parse(raw) as Partial<Learner>;
    return { mastery: parsed.mastery ?? {}, log: parsed.log ?? [], spots: parsed.spots ?? [] };
  } catch {
    return emptyLearner;
  }
}

export function saveLearner(l: Learner): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(l));
  } catch {
    // Storage can be full or blocked. Learning still works for this session.
  }
}

/**
 * Approved concepts from the owner's books. `books/` is gitignored, so these exist only on the
 * owner's machine. A concept that names an unknown predicate is dropped, never guessed at.
 */
const bookFiles = import.meta.glob<{ default: unknown }>("/books/*/concepts.json", { eager: true });

function parseBookConcepts(raw: unknown): Concept[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((c: Record<string, unknown>) => {
    const appliesWhen = Array.isArray(c.appliesWhen) ? c.appliesWhen.filter((p): p is string => typeof p === "string") : [];
    const ok = typeof c.id === "string" && typeof c.title === "string" && typeof c.statement === "string"
      && Array.isArray(c.sources) && c.sources.length > 0 && appliesWhen.length > 0 && appliesWhen.every(isPredicateId);
    if (!ok) return [];
    // Book concepts teach but never take credit for a grade. The grader measures only built-in claims.
    return [{ ...(c as unknown as Concept), prerequisites: [], graded: false, appliesWhen: appliesWhen.filter(isPredicateId) }];
  });
}

export const ALL_CONCEPTS: readonly Concept[] = [
  ...CORE_CONCEPTS,
  ...Object.values(bookFiles).flatMap((m) => parseBookConcepts(m.default)),
];
