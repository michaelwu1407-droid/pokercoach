import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import type { Concept } from "../../src/learn/concepts";
import { type CheckedCandidate, toConcept } from "../../src/kb/validate";

// Usage: npm run kb:review -- <book-id>
// Shows each candidate with its quote. You approve, reject, or skip. Approved concepts go to
// books/<id>/concepts.json, which the app loads on the next start. Nothing teaches until approved.

const bookId = process.argv[2];
if (!bookId) throw new Error("usage: npm run kb:review -- <book-id>");
const dir = `books/${bookId}`;
const book = JSON.parse(readFileSync(`${dir}/book.json`, "utf8")) as { title: string };
const { accepted } = JSON.parse(readFileSync(`${dir}/candidates.json`, "utf8")) as { accepted: CheckedCandidate[] };
const approvedPath = `${dir}/concepts.json`;
const decisionsPath = `${dir}/decisions.json`;
const approved: Concept[] = existsSync(approvedPath) ? JSON.parse(readFileSync(approvedPath, "utf8")) : [];
const decided: Record<string, "yes" | "no"> = existsSync(decisionsPath) ? JSON.parse(readFileSync(decisionsPath, "utf8")) : {};

const pending = accepted.filter((c) => !decided[c.id]);
console.log(`${pending.length} candidates to review from "${book.title}". Keys: y approve, n reject, s skip, q quit.\n`);
const rl = createInterface({ input: process.stdin, output: process.stdout });
for (const [i, c] of pending.entries()) {
  console.log(`[${i + 1}/${pending.length}] ${c.title}`);
  console.log(`  Says:    ${c.statement}`);
  console.log(`  Quote:   "${c.quote}" (${c.location})`);
  console.log(`  Applies: ${c.appliesWhen.join(" + ")}`);
  const answer = (await rl.question("  Approve? [y/n/s/q] ")).trim().toLowerCase();
  if (answer === "q") break;
  if (answer === "y") {
    decided[c.id] = "yes";
    approved.push(toConcept(c, book.title));
  } else if (answer === "n") decided[c.id] = "no";
  writeFileSync(approvedPath, JSON.stringify(approved, null, 1));
  writeFileSync(decisionsPath, JSON.stringify(decided, null, 1));
  console.log();
}
rl.close();
console.log(`${approved.length} approved concepts in ${approvedPath}. Restart the app to load them.`);
