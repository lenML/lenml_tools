import fs from "fs";
import path from "path";

import { NumPuzzleEvaluator } from "./components/evaluators/num_puzzle";
import { current_model, program_options } from "./args";

async function main() {
  const results_filepath = path.resolve(
    __dirname,
    `./results/num_puzzle/${program_options.name}.json`
  );
  if (fs.existsSync(results_filepath)) {
    console.log(`Results file exists: ${results_filepath}`);
    process.exit(0);
  }

  const model = current_model;
  const evaluator = new NumPuzzleEvaluator(model);

  // 随机生成 10 个 0 - 5000 的数字
  const testcases = Array.from({ length: 10 }, () => ({
    target: Math.floor(Math.random() * 5000),
  }));
  const result = await evaluator.evaluate(testcases);

  fs.writeFileSync(results_filepath, JSON.stringify(result, null, 2));
  console.log(`Final score: ${result.score}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
