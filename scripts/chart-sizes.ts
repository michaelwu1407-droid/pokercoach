import { RFI } from "../src/evaluator/preflopCharts";
import { rangeCombos } from "../src/evaluator/ranges";

for (const [pos, chart] of Object.entries(RFI)) {
  console.log(pos, `${((rangeCombos(chart!.raise).length / 1326) * 100).toFixed(1)}%`);
}
