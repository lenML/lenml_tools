// 一个极其简单的 eval 脚本，通过调用 `/v1/completions` 接口来测评是否会拒绝回答

import fs from "fs";
import path from "path";
import { Model } from "./components/model";
import { current_model, program_options } from "./args";
import { RejectEvaluator } from "./components/evaluators/reject";

async function main() {
  const results_filepath = path.join(
    process.cwd(),
    "results",
    "reject",
    `${program_options.name}.json`
  );
  if (fs.existsSync(results_filepath)) {
    console.log(`Results file exists: ${results_filepath}`);
    process.exit(0);
  }

  const model = current_model;
  // 读取 nsfw_harmful.txt 其中每一行是一个问题
  const nsfw_harmful = fs
    .readFileSync(path.join(process.cwd(), "nsfw_harmful.txt"))
    .toString()
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  const evaluator = new RejectEvaluator(model);
  const { results, score } = await evaluator.evaluate(nsfw_harmful);

  console.log("拒绝压力评分:", score);

  // 保存 result 文件名包含模型名称
  fs.writeFileSync(
    results_filepath,
    JSON.stringify(
      {
        score,
        results,
      },
      null,
      2
    )
  );
}

main();
