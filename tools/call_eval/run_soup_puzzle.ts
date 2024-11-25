import fs from "fs";
import path from "path";

import { Model } from "./components/model";
import { SimpleQAEvaluator } from "./components/evaluators/simple_qa";
import { SoupPuzzleEvaluator } from "./components/evaluators/soup_puzzle";

const BASE_URL = "http://127.0.0.1:1234";

const soup_puzzle_testcases = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "datasets", "./soup_puzzle.json"),
    "utf-8"
  )
);

async function main() {
  const [model_name] = process.argv.slice(2);
  if (!model_name) {
    // 就是保存结果的时候用
    throw new Error("model name is required");
  }

  const model = new Model({
    BASE_URL,
    temperature: 0.75,
  });
  const evaluator = new SoupPuzzleEvaluator(model);

  const result = await evaluator.evaluate(soup_puzzle_testcases.slice(0, 1));

  fs.writeFileSync(
    path.resolve(__dirname, `./results/soup_puzzle/${model_name}.json`),
    JSON.stringify(result, null, 2)
  );
  console.log(`Final score: ${result.accuracy}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
