// 一个极其简单的 eval 脚本，通过调用 `/v1/completions` 接口来测评续写能力
import fs from "fs";
import path from "path";
import { current_model, program_options } from "./args";
import { CompletionEvaluator } from "./components/evaluators/completion";

function loadJson(filepath) {
  return JSON.parse(fs.readFileSync(filepath).toString());
}

async function main() {
  const results_filepath = path.join(
    process.cwd(),
    "results",
    "hardcore",
    `${program_options.name}.json`
  );
  if (fs.existsSync(results_filepath)) {
    console.log(`Results file exists: ${results_filepath}`);
    process.exit(0);
  }
  const eval_data = loadJson(path.join(process.cwd(), "h_eval.json"));

  const model = current_model;
  const evaluator = new CompletionEvaluator(model);
  const results = await evaluator.evaluate(eval_data);

  fs.writeFileSync(results_filepath, JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
