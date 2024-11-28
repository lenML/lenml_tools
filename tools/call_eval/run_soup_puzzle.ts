import "./preload";

import fs from "fs";
import path from "path";

import { Model } from "./components/model";
import { SimpleQAEvaluator } from "./components/evaluators/simple_qa";
import { SoupPuzzleEvaluator } from "./components/evaluators/soup_puzzle";
import { current_model, program_options } from "./args";

const BASE_URL = "http://127.0.0.1:1234";

const soup_puzzle_testcases = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "datasets", "./soup_puzzle.json"),
    "utf-8"
  )
);

async function main() {
  const model = current_model;
  const evaluator = new SoupPuzzleEvaluator(model);

  const result = await evaluator.evaluate(soup_puzzle_testcases.slice(0, 1));

  fs.writeFileSync(
    path.resolve(
      __dirname,
      `./results/soup_puzzle/${program_options.name}.json`
    ),
    JSON.stringify(result, null, 2)
  );
  console.log(`Final score: ${result.accuracy}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
