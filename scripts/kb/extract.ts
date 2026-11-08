import { existsSync, readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Chunk } from "../../src/kb/chunk";
import { check, type CheckedCandidate, isRejection, type Rejection } from "../../src/kb/validate";
import { PREDICATES } from "../../src/learn/spot";

// Usage: npm run kb:extract -- <book-id> [--limit N]
// Proposes concepts per chunk, keeps only those whose quote is verbatim in the chunk, and writes
// books/<id>/candidates.json for review. Resumable: chunks already processed are skipped.

const MODEL = "claude-opus-5-5";
const CONCURRENCY = 4;

const [bookId, ...rest] = process.argv.slice(2);
if (!bookId) throw new Error("usage: npm run kb:extract -- <book-id> [--limit N]");
const limitIdx = rest.indexOf("--limit");
const limit = limitIdx >= 0 ? Number(rest[limitIdx + 1]) : Infinity;
const dir = `books/${bookId}`;
const book = JSON.parse(readFileSync(`${dir}/book.json`, "utf8")) as { title: string };
const chunks = JSON.parse(readFileSync(`${dir}/chunks.json`, "utf8")) as Chunk[];

interface Progress { done: string[]; accepted: CheckedCandidate[]; rejected: (Rejection & { chunkId: string })[] }
const outPath = `${dir}/candidates.json`;
const progress: Progress = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : { done: [], accepted: [], rejected: [] };

const predicateIds = Object.keys(PREDICATES) as [keyof typeof PREDICATES, ...(keyof typeof PREDICATES)[]];
const Schema = z.object({
  concepts: z.array(z.object({
    title: z.string().describe("Short name, under 8 words."),
    statement: z.string().describe("One plain sentence a learner can act on at the table."),
    quote: z.string().describe("A passage copied exactly, word for word, from the text that supports the statement."),
    appliesWhen: z.array(z.enum(predicateIds)).describe("Every situation test that must hold for this to apply."),
  })),
});

const SYSTEM = `You extract actionable No-Limit Hold'em concepts from a poker book to teach a beginner while they play.
Only extract advice a player can act on at a specific decision. Skip history, anecdotes, rules of the game and vague motivation.
Never state a number the text does not state. The quote must be copied exactly from the text, long enough to support the statement.
Tag each concept with every situation test that must hold. Available tests: ${predicateIds.join(", ")}.
If no test fits the advice, leave the concept out. Return an empty list when the passage has nothing actionable.`;

const client = new Anthropic();

async function extract(chunk: Chunk) {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Book: ${book.title}\nLocation: ${chunk.location}\n\n<text>\n${chunk.text}\n</text>` }],
    output_config: { format: betaZodOutputFormat(Schema) },
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return [];
  return response.parsed_output.concepts;
}

const todo = chunks.filter((c) => !progress.done.includes(c.id)).slice(0, limit);
console.log(`${todo.length} chunks to process with ${MODEL}.`);
let next = 0;
async function worker() {
  while (next < todo.length) {
    const chunk = todo[next++]!;
    try {
      for (const c of await extract(chunk)) {
        const r = check(c, chunk, bookId!);
        if (isRejection(r)) progress.rejected.push({ ...r, chunkId: chunk.id });
        else if (!progress.accepted.some((a) => a.id === r.id)) progress.accepted.push(r);
      }
      progress.done.push(chunk.id);
      writeFileSync(outPath, JSON.stringify(progress, null, 1));
      process.stdout.write(`\r${progress.done.length}/${chunks.length} chunks, ${progress.accepted.length} candidates`);
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) (next--, await new Promise((r) => setTimeout(r, 20_000)));
      else if (e instanceof Anthropic.APIError) console.error(`\nchunk ${chunk.id}: API error ${e.status}: ${e.message}`);
      else {
        console.error("\nExtraction stopped. If this is about authentication, set ANTHROPIC_API_KEY or run `ant auth login`.");
        throw e;
      }
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`\nDone. ${progress.accepted.length} candidates, ${progress.rejected.length} rejected by the quote check.`);
console.log(`Next: npm run kb:review -- ${bookId}`);
