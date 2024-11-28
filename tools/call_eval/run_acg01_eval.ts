import "./preload";
import fs from "fs";
import path from "path";

import { Model } from "./components/model";
import { SimpleQAEvaluator } from "./components/evaluators/simple_qa";
import { current_model, program_options } from "./args";

const len_acg01_testcases = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "datasets", "./len_acg01-cleaned.json"),
    "utf-8"
  )
);

async function main() {
  const results_filepath = path.resolve(
    __dirname,
    `./results/acg01/${program_options.name}.json`
  );
  if (fs.existsSync(results_filepath)) {
    console.log(`Results file exists: ${results_filepath}`);
    process.exit(0);
  }
  const model = current_model;
  const evaluator = new SimpleQAEvaluator(model);
  const result = await evaluator.evaluate(len_acg01_testcases);

  fs.writeFileSync(results_filepath, JSON.stringify(result, null, 2));
  console.log(`Final score: ${result.accuracy}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
