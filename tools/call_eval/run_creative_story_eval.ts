import fs from "fs";
import path from "path";

import { CreativeStoryEvaluator } from "./components/evaluators/creative_story";
import { Model } from "./components/model";
import { story_testcases } from "./components/testcases/story";

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
  const evaluator = new CreativeStoryEvaluator(model);

  const results = await evaluator.evaluate(story_testcases);
  const final_scores = {
    long_score:
      results.map((x) => x.long_score).reduce((a, b) => a + b, 0) /
      results.length,
    creative_score:
      results.map((x) => x.creative_score).reduce((a, b) => a + b, 0) /
      results.length,
  };

  fs.writeFileSync(
    path.resolve(__dirname, `./results/${model_name}_len_req.json`),
    JSON.stringify(
      {
        results,
        final_scores,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
