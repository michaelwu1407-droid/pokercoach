import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

// Packs the production build into one self-contained page for sharing as a claude.ai artifact.
// Run after `vite build`. Output: artifact/pokercoach.html (gitignored).
const dir = "dist/assets";
const files = readdirSync(dir);
const css = files.filter((f) => f.endsWith(".css")).map((f) => readFileSync(`${dir}/${f}`, "utf8")).join("\n");
const js = files.filter((f) => f.endsWith(".js")).map((f) => readFileSync(`${dir}/${f}`, "utf8")).join("\n");
const page = `<title>pokercoach</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js.replace(/<\/script/gi, "<\\/script")}</script>
`;
mkdirSync("artifact", { recursive: true });
writeFileSync("artifact/pokercoach.html", page);
console.log(`artifact/pokercoach.html ${(page.length / 1024).toFixed(0)}KB`);
