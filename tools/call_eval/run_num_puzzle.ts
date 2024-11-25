import fs from "fs";
import path from "path";

import { Model } from "./components/model";
import { NumPuzzleEvaluator } from "./components/evaluators/num_puzzle";

const BASE_URL = "http://127.0.0.1:1234";

async function main() {
  const [model_name] = process.argv.slice(2);
  if (!model_name) {
    // 就是保存结果的时候用
    throw new Error("model name is required");
  }

  const model = new Model({
    BASE_URL,
    temperature: 0.5,
  });
  const evaluator = new NumPuzzleEvaluator(model);

  // 随机生成 5 个 0 - 5000 的数字
  const testcases = Array.from({ length: 5 }, () => ({
    target: Math.floor(Math.random() * 5000),
  }));
  const result = await evaluator.evaluate(testcases);

  fs.writeFileSync(
    path.resolve(__dirname, `./results/num_puzzle/${model_name}.json`),
    JSON.stringify(result, null, 2)
  );
  console.log(`Final score: ${result.accuracy}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
