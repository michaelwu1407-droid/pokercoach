import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname } from "node:path";
import JSZip from "jszip";
import { chunkPages, type Page } from "../../src/kb/chunk";

// Usage: npm run kb:ingest -- <file.pdf|file.epub|file.txt|file.md> [--title "Book Title"]
// Writes books/<id>/book.json and books/<id>/chunks.json. The books/ folder is gitignored.

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) throw new Error('usage: npm run kb:ingest -- <file> [--title "Book Title"]');
const titleIdx = args.indexOf("--title");
const title = titleIdx >= 0 ? args[titleIdx + 1]! : basename(file, extname(file));
const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function pdfPages(path: string): Promise<Page[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(path)), useSystemFonts: true }).promise;
  const pages: Page[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str + (item.hasEOL ? "\n" : "");
    }
    // A line that ends a sentence and is followed by a short gap usually ends a paragraph in book PDFs.
    pages.push({ location: `p. ${n}`, text: text.replace(/([.!?]["')]?)\n/g, "$1\n\n") });
  }
  return pages;
}

const htmlToText = (html: string) =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>|<br\s*\/?>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&rdquo;|&ldquo;/g, '"');

async function epubPages(path: string): Promise<Page[]> {
  const zip = await JSZip.loadAsync(readFileSync(path));
  const container = await zip.file("META-INF/container.xml")!.async("string");
  const opfPath = /full-path="([^"]+)"/.exec(container)![1]!;
  const base = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  const opf = await zip.file(opfPath)!.async("string");
  const manifest = new Map([...opf.matchAll(/<item\b[^>]*\bid="([^"]+)"[^>]*\bhref="([^"]+)"/g)].map((m) => [m[1]!, m[2]!]));
  const spine = [...opf.matchAll(/<itemref\b[^>]*\bidref="([^"]+)"/g)].map((m) => m[1]!);
  const pages: Page[] = [];
  for (const [i, ref] of spine.entries()) {
    const href = manifest.get(ref);
    const entry = href && zip.file(base + decodeURIComponent(href));
    if (!entry) continue;
    const html = await entry.async("string");
    const heading = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(html)?.[1]?.replace(/<[^>]+>/g, "").trim();
    pages.push({ location: heading ? `"${heading}" (section ${i + 1})` : `section ${i + 1}`, text: htmlToText(html) });
  }
  return pages;
}

const ext = extname(file).toLowerCase();
const pages = ext === ".pdf" ? await pdfPages(file)
  : ext === ".epub" ? await epubPages(file)
  : [{ location: "text", text: readFileSync(file, "utf8") }];
const chunks = chunkPages(pages).filter((c) => c.text.length > 80);
mkdirSync(`books/${id}`, { recursive: true });
writeFileSync(`books/${id}/book.json`, JSON.stringify({ id, title, source: basename(file) }, null, 2));
writeFileSync(`books/${id}/chunks.json`, JSON.stringify(chunks, null, 1));
console.log(`Ingested "${title}" as books/${id}: ${pages.length} pages or sections, ${chunks.length} chunks.`);
console.log(`Next: npm run kb:extract -- ${id}`);
