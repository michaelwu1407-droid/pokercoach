import { writeFileSync } from "node:fs";
import { equityVsRange } from "../src/evaluator/equity";
import { ALL_CLASSES, combosOf, rangeCombos } from "../src/evaluator/ranges";

// Equity of each starting-hand class against a uniformly random hand. Feeds bot hand-strength.
const random = rangeCombos(ALL_CLASSES);
const rows = ALL_CLASSES.map((cls, i) => {
  const r = equityVsRange(combosOf(cls)[0]!, random, [], { samples: 20_000, seed: 1000 + i });
  return [cls, Number(r.equity.toFixed(4))] as const;
}).sort((a, b) => b[1] - a[1]);
const out = Object.fromEntries(rows);
writeFileSync("src/evaluator/preflopStrength.json", JSON.stringify(out, null, 0) + "\n");
console.log("top", rows.slice(0, 3), "bottom", rows.slice(-3));
