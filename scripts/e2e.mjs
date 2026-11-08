import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const PORT = 4179;
const OUT = process.env.E2E_OUT ?? "e2e-output";
mkdirSync(OUT, { recursive: true });

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "pipe", detached: true });
await new Promise((resolve, reject) => {
  server.stdout.on("data", (d) => String(d).includes(String(PORT)) && resolve());
  server.on("exit", (code) => reject(new Error(`preview exited ${code}`)));
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
await page.clock.install();
page.setDefaultTimeout(5000);
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

try {
  await page.goto(`http://localhost:${PORT}/`);
  await page.getByTestId("table").waitFor();
  const seen = { predict: 0, reveal: 0, citations: 0, review: 0, decisions: 0 };

  // Plays hands with a deliberately loose style: raise when possible, else call. It makes chart mistakes,
  // which the coach must catch and save as drills.
  for (let step = 0; step < 400 && seen.review < 12; step++) {
    if (process.env.E2E_DEBUG) console.log(step, JSON.stringify(seen));
    if (await page.getByTestId("predict").isVisible()) seen.predict++;
    if (await page.getByTestId("dismiss").isVisible()) {
      seen.reveal++;
      if (await page.getByTestId("citations").isVisible()) seen.citations++;
      if (seen.reveal === 1) await page.screenshot({ path: `${OUT}/reveal.png` });
      await page.getByTestId("dismiss").click();
      continue;
    }
    if (await page.getByTestId("next-hand").isVisible()) {
      seen.review++;
      assert.match(await page.getByTestId("review").innerText(), /does not affect your grades/);
      if (seen.review === 1) await page.screenshot({ path: `${OUT}/review.png` });
      await page.getByTestId("next-hand").click();
      continue;
    }
    if (await page.getByTestId("action-bar").isVisible()) {
      if (await page.getByTestId("reason").isVisible()) await page.getByTestId("reason").fill("testing a loose line");
      const raise = page.getByTestId("act-raise");
      const call = page.getByTestId("act-call");
      seen.decisions++;
      if (await raise.isVisible()) await raise.click();
      else if (await call.isVisible()) await call.click();
      else await page.getByTestId("act-check").click();
    }
  }
  console.log("seen", seen);
  assert.ok(seen.review >= 12, "played at least 12 hands to review");
  assert.ok(seen.predict >= 1, "coach paused on a studied spot");
  assert.ok(seen.reveal >= 3, "coach revealed grades");
  assert.ok(seen.citations >= 1, "a reveal cited its source");

  // Mistakes return as drills a few minutes later, not immediately.
  await page.clock.fastForward("05:00");
  await page.getByTestId("tab-progress").click();
  await page.getByTestId("tab-play").click();
  const drillButton = page.getByTestId("start-drills");
  assert.match(await drillButton.innerText(), /Drills \([1-9]\d* due\)/);
  await drillButton.click();
  await page.getByTestId("drill-banner").waitFor();
  await page.getByTestId("drill-prompt").waitFor();
  const raiseButton = page.getByTestId("act-raise");
  if (await raiseButton.isVisible()) {
    const before = await raiseButton.innerText();
    await page.getByText("All-in").click();
    assert.notEqual(await raiseButton.innerText(), before, "a sizing preset changes the raise amount");
  }
  await page.screenshot({ path: `${OUT}/drill.png` });
  for (const id of ["act-fold", "act-check", "act-call"]) {
    if (await page.getByTestId(id).isVisible()) {
      await page.getByTestId(id).click();
      break;
    }
  }
  await page.getByTestId("reveal").waitFor();

  await page.getByTestId("tab-progress").click();
  assert.match(await page.getByTestId("progress").innerText(), /EV lost per decision/);
  await page.screenshot({ path: `${OUT}/progress.png` });
  await page.getByTestId("tab-concepts").click();
  assert.match(await page.getByTestId("concepts").innerText(), /Pot odds/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("tab-play").click();
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(scrollW <= 390, `no horizontal scroll on phone width (got ${scrollW})`);
  await page.screenshot({ path: `${OUT}/phone.png` });

  assert.deepEqual(errors, [], "no page errors");
  console.log("e2e passed");
} finally {
  await browser.close();
  process.kill(-server.pid);
}
