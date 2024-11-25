import fs from "fs";
import path from "path";

import { Model } from "./components/model";
import { SimpleQAEvaluator } from "./components/evaluators/simple_qa";

const BASE_URL = "http://127.0.0.1:1234";

const len_acg01_testcases = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "datasets", "./len_acg01-cleaned.json"),
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
    temperature: 0.2,
  });

  // const grok_beta = new Model({
  //   BASE_URL: "https://api.x.ai",
  //   API_KEY:
  //     "xai-H85PNYCySZ9nC7gfsA3bjmZxTQwpjCofOY4qIvqV6bXIbORb6P8g4RJzgOsHxDGLmue7zgySKldm5OV8",
  //   model: "grok-beta",
  //   temperature: 0.2,
  // });
  // // 不支持 schema
  // grok_beta.support_schema = false;

  const evaluator = new SimpleQAEvaluator(model);

  const result = await evaluator.evaluate(len_acg01_testcases);

  fs.writeFileSync(
    path.resolve(__dirname, `./results/acg01/${model_name}.json`),
    JSON.stringify(result, null, 2)
  );
  console.log(`Final score: ${result.accuracy}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
