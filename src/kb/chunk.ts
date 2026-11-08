export interface Page {
  /** Human location shown in citations, such as "p. 42" or "Chapter 3". */
  readonly location: string;
  readonly text: string;
}

export interface Chunk {
  readonly id: string;
  readonly location: string;
  readonly text: string;
}

export const normalise = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Splits pages into chunks of roughly `target` characters on paragraph boundaries. A chunk never
 * spans two pages, so its location stays exact for citations.
 */
export function chunkPages(pages: readonly Page[], target = 1800): Chunk[] {
  const out: Chunk[] = [];
  for (const page of pages) {
    const paragraphs = page.text.split(/\n\s*\n/).map(normalise).filter(Boolean);
    let buf = "";
    const flush = () => {
      if (buf) out.push({ id: `c${String(out.length).padStart(5, "0")}`, location: page.location, text: buf });
      buf = "";
    };
    for (const p of paragraphs) {
      if (buf && buf.length + p.length + 1 > target) flush();
      if (p.length > target * 1.5) {
        flush();
        for (const word of p.split(" ")) {
          if (buf && buf.length + word.length + 1 > target) flush();
          buf = buf ? `${buf} ${word}` : word;
        }
        continue;
      }
      buf = buf ? `${buf}\n\n${p}` : p;
    }
    flush();
  }
  return out;
}
