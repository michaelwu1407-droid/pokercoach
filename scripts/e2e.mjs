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
  await page.getByTestId("help").waitFor();
  await page.screenshot({ path: `${OUT}/help.png` });
  await page.keyboard.press("f");
  assert.ok(await page.getByTestId("help").isVisible(), "shortcuts are inactive while the guide is open");
  await page.keyboard.press("Escape");
  await page.getByTestId("help").waitFor({ state: "hidden" });
  await page.getByTestId("table").waitFor();
  assert.ok(await page.getByTestId("new-table").isVisible(), "first hand announces a new table");
  assert.match(await page.getByTestId("you-have").innerText(), /You have: /);
  const seen = { keyed: 0, feedback: 0, mix: 0, read: 0, pauses: 0, hands: 0, decisions: 0, maxButtons: 0 };
  let lastFeedback = "";

  // A deliberately loose player: raise when possible, else call. It makes mistakes the coach must catch.
  for (let step = 0; step < 500 && seen.hands < 12; step++) {
    if (process.env.E2E_DEBUG) console.log(step, JSON.stringify(seen));
    if (await page.getByTestId("feedback").isVisible()) {
      const text = await page.getByTestId("feedback").innerText();
      if (text !== lastFeedback) {
        lastFeedback = text;
        seen.feedback++;
        assert.ok((await page.getByTestId("key-point").innerText()).length > 10, "every feedback card has a key point");
        if (await page.getByTestId("range-mix").isVisible()) seen.mix++;
        if (await page.getByTestId("read").isVisible()) seen.read++;
        if (seen.mix === 1 && (await page.getByTestId("range-mix").isVisible())) await page.screenshot({ path: `${OUT}/feedback.png` });
      }
    }
    if (await page.getByTestId("continue").isVisible()) {
      seen.pauses++;
      await page.getByTestId("continue").click();
      continue;
    }
    if (await page.getByTestId("next-hand").isVisible()) {
      seen.hands++;
      assert.match(await page.getByTestId("review").innerText(), /Your decisions are what count/);
      // A walk (everyone folds to your big blind) ends at once, so wait for the table to change, not the button to go.
      const before = await page.evaluate(() => document.querySelector("[data-testid=table]")?.textContent ?? "");
      if (seen.hands % 2 === 0) await page.keyboard.press("Space");
      else await page.getByTestId("next-hand").click();
      await page.waitForFunction((b) => document.querySelector("[data-testid=table]")?.textContent !== b, before);
      continue;
    }
    if (await page.getByTestId("action-bar").isVisible()) {
      seen.decisions++;
      seen.maxButtons = Math.max(seen.maxButtons, await page.getByTestId("action-bar").locator("button").count());
      if (seen.decisions === 1) await page.screenshot({ path: `${OUT}/decision.png` });
      if (seen.decisions % 3 === 0) {
        const events = await page.evaluate(() => document.querySelector("[data-testid=table]")?.textContent ?? "");
        await page.keyboard.press("c");
        await page.waitForFunction((before) => document.querySelector("[data-testid=table]")?.textContent !== before, events);
        seen.keyed++;
        continue;
      }
      for (const id of ["act-raise", "act-call", "act-check"]) {
        if (await page.getByTestId(id).isVisible()) {
          await page.getByTestId(id).click();
          break;
        }
      }
    }
  }
  console.log("seen", seen);
  assert.ok(seen.hands >= 12, "played 12 hands");
  assert.ok(seen.feedback >= 5, "feedback after decisions");
  assert.ok(seen.mix >= 1, "showed what the opponent likely has");
  assert.ok(seen.read >= 1, "revealed an opponent's style");
  assert.ok(seen.maxButtons <= 5, "at most five action buttons");
  assert.ok(seen.keyed >= 3, "keyboard shortcuts drove some decisions");

  // Mistakes return as practice a few minutes later, not immediately.
  await page.clock.fastForward("05:00");
  await page.getByTestId("tab-progress").click();
  await page.getByTestId("tab-play").click();
  await page.getByTestId("start-drills").click();
  await page.getByTestId("drill-banner").waitFor();
  for (const id of ["act-fold", "act-check", "act-call"]) {
    if (await page.getByTestId(id).isVisible()) {
      await page.getByTestId(id).click();
      break;
    }
  }
  await page.getByTestId("feedback").waitFor();
  await page.screenshot({ path: `${OUT}/drill.png` });
  await page.getByTestId("next-drill").click();

  await page.getByTestId("tab-progress").click();
  assert.match(await page.getByTestId("progress").innerText(), /EV lost per decision/);
  await page.screenshot({ path: `${OUT}/progress.png` });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("tab-play").click();
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(scrollW <= 390, `no horizontal scroll on phone width (got ${scrollW})`);
  await page.screenshot({ path: `${OUT}/phone.png`, fullPage: true });

  assert.deepEqual(errors, [], "no page errors");
  console.log("e2e passed");
} finally {
  await browser.close();
  process.kill(-server.pid);
}
