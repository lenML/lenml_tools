import "./preload";

import fs from "fs";
import path from "path";

import { CreativeStoryEvaluator } from "./components/evaluators/creative_story";
import { Model } from "./components/model";
import { story_testcases } from "./components/testcases/story";
import { current_model, program_options } from "./args";

async function main() {
  const results_filepath = path.resolve(
    __dirname,
    `./results/creative/${program_options.name}.json`
  );
  if (fs.existsSync(results_filepath)) {
    console.log(`Results file exists: ${results_filepath}`);
    process.exit(0);
  }
  const model = current_model;
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
    results_filepath,
    JSON.stringify(
      {
        final_scores,
        results,
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
