import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { JARGON } from "../src/coach/words.ts";

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
// The same deals every run, so a failure always reproduces. Unit tests cover the variety of hands.
await page.addInitScript((seed) => {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}, Number(process.env.E2E_SEED ?? 7));
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
  assert.match(await page.getByTestId("you-have").innerText(), /You have: /);
  const seen = { keyed: 0, sized: 0, skipped: 0, feedback: 0, mix: 0, read: 0, reviews: 0, recaps: 0, reopened: 0, hands: 0, decisions: 0, maxButtons: 0 };
  let lastFeedback = "";

  // A deliberately loose player: raise when possible, else call. It makes mistakes the coach must catch.
  for (let step = 0; step < 500 && seen.hands < 12; step++) {
    if (process.env.E2E_DEBUG) console.log(step, JSON.stringify(seen));
    const screen = await page.locator("main").innerText();
    const hit = screen.split("\n").find((line) => JARGON.test(line));
    assert.equal(hit, undefined, `jargon on screen: "${hit}"`);
    if (await page.getByTestId("feedback").isVisible()) {
      const text = await page.getByTestId("feedback").innerText();
      if (text !== lastFeedback) {
        lastFeedback = text;
        seen.feedback++;
        assert.ok((await page.getByTestId("summary").innerText()).length > 10, "every feedback card has a one-line summary");
        if (seen.feedback === 1) {
          assert.equal(await page.getByTestId("key-point").isVisible(), false, "detail starts folded away");
          await page.locator(".more > summary").click();
        }
        assert.ok((await page.getByTestId("key-point").innerText()).length > 10, "detail stays open once opened");
        if (await page.getByTestId("range-mix").isVisible()) seen.mix++;
        if (await page.getByTestId("read").isVisible()) seen.read++;
        if (seen.mix === 1 && (await page.getByTestId("range-mix").isVisible())) await page.screenshot({ path: `${OUT}/feedback.png` });
      }
    }
    if (await page.getByTestId("next-hand").isVisible()) {
      seen.hands++;
      assert.match(await page.getByTestId("review").innerText(), /this hand/);
      if (await page.getByTestId("review-list").isVisible()) {
        // Every decision of the hand is listed; opening the first shows its card.
        seen.reviews++;
        await page.locator(".review-row").first().click();
        await page.getByTestId("summary").waitFor();
      }
      // A walk (everyone folds to your big blind) ends at once, so wait for the table to change, not the button to go.
      const before = await page.evaluate(() => document.querySelector("[data-testid=table]")?.textContent ?? "");
      if (seen.hands % 2 === 0) await page.keyboard.press("Space");
      else await page.getByTestId("next-hand").click();
      await page.waitForFunction((b) => document.querySelector("[data-testid=table]")?.textContent !== b, before);
      continue;
    }
    if (await page.getByTestId("action-bar").isVisible()) {
      seen.decisions++;
      // You decide first: on your turn the coach shows only a one-line recap, never the full card.
      assert.equal(await page.getByTestId("feedback").isVisible(), false, "no feedback card while deciding");
      if (await page.getByTestId("last-line").isVisible()) {
        seen.recaps++;
        // The folded card opens on request, and closes again before deciding.
        if (seen.recaps === 1 && (await page.getByTestId("grading").count()) === 0) {
          await page.getByTestId("last-line").click();
          await page.getByTestId("summary").waitFor();
          seen.reopened++;
          await page.getByTestId("last-line").click();
        }
      }
      seen.maxButtons = Math.max(seen.maxButtons, await page.locator(".main-actions button").count());
      if (seen.sized < 2 && (await page.getByTestId("act-raise").isVisible())) {
        // Raise opens the sizer: a preset, then the arrow keys, change the amount on the confirm button.
        await page.getByTestId("act-raise").click();
        await page.getByTestId("sizing").waitFor();
        await page.locator(".presets button").first().click();
        const presetLabel = await page.getByTestId("act-raise-confirm").innerText();
        const [value, hi] = await page.getByTestId("slider").evaluate((el) => [Number(el.value), Number(el.max)]);
        if (value + 100 < hi) {
          await page.keyboard.press("ArrowUp");
          assert.notEqual(await page.getByTestId("act-raise-confirm").innerText(), presetLabel, "arrow keys change the amount");
        }
        await page.getByTestId("act-raise-confirm").click();
        seen.sized++;
        continue;
      }
      if (seen.decisions === 1) await page.screenshot({ path: `${OUT}/decision.png` });
      if (seen.decisions % 3 === 0) {
        const events = await page.evaluate(() => document.querySelector("[data-testid=table]")?.textContent ?? "");
        await page.keyboard.press("c");
        await page.waitForFunction((before) => document.querySelector("[data-testid=table]")?.textContent !== before, events);
        seen.keyed++;
        continue;
      }
      if (await page.getByTestId("act-raise").isVisible()) {
        await page.getByTestId("act-raise").click();
        await page.getByTestId("act-raise-confirm").click();
      } else if (await page.getByTestId("act-call").isVisible()) await page.getByTestId("act-call").click();
      else await page.getByTestId("act-check").click();
      continue;
    }
    // Grading runs in the background. A learner reads the card while the others act, so wait for it.
    // Grading runs in the background. A learner reads the card while the others act, so wait for it,
    // unless your next turn comes first and the card folds to its one-line recap.
    if (await page.getByTestId("grading").isVisible()) {
      await page.getByTestId("summary").or(page.getByTestId("last-line")).first().waitFor();
      continue;
    }
    // Nothing to click: the others are still acting. Space skips ahead.
    seen.skipped++;
    await page.keyboard.press("Space");
    await page.waitForTimeout(50);
  }
  console.log("seen", seen);
  assert.ok(seen.hands >= 12, "played 12 hands");
  assert.ok(seen.feedback >= 5, "feedback after decisions");
  assert.ok(seen.mix >= 1, "showed what the opponent likely has");
  assert.ok(seen.read >= 1, "revealed an opponent's style");
  assert.ok(seen.maxButtons <= 3, "fold, check or call, and one raise button");
  assert.ok(seen.sized >= 1, "sized a bet with a preset and the arrow keys");
  assert.ok(seen.reviews >= 1, "reviewed a hand's decisions in the list");
  assert.ok(seen.recaps >= 1, "showed the last decision's verdict as one line");
  assert.ok(seen.reopened >= 1, "reopened the last decision's full card on your turn");
  assert.ok(seen.skipped >= 1, "skipped ahead through the others' actions");
  const fits = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
  assert.ok(fits, "the play screen fits the window without scrolling");
  assert.ok(seen.keyed >= 3, "keyboard shortcuts drove some decisions");

  // Mistakes return as practice a few minutes later, not immediately.
  await page.clock.fastForward("05:00");
  await page.getByTestId("tab-progress").click();
  await page.getByTestId("tab-progress").click();
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
  const progressText = await page.getByTestId("progress").innerText();
  assert.match(progressText, /Lost per decision/);
  assert.equal(progressText.split("\n").find((line) => JARGON.test(line)), undefined, "no jargon on the progress page");
  await page.screenshot({ path: `${OUT}/progress.png` });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("tab-progress").click();
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(scrollW <= 390, `no horizontal scroll on phone width (got ${scrollW})`);
  await page.screenshot({ path: `${OUT}/phone.png`, fullPage: true });

  assert.deepEqual(errors, [], "no page errors");
  console.log("e2e passed");
} finally {
  await browser.close();
  process.kill(-server.pid);
}
