import { BaseEvaluator } from "../evaluator";
import { SimpleQAJudger } from "../judgers/acg01";
import { Model } from "../model";
import fs from "fs";
import path from "path";
import { shuffle } from "lodash-es";

type Item = { question: string; options: string[]; answer: string };

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, "simple_qa.prompt.txt"),
  "utf-8"
);

const mk_json_schema = (options: string[]) => ({
  type: "object",
  properties: {
    explanation: { type: "string" },
    answer: {
      type: "string",
      enum: options,
    },
  },
  required: ["explanation", "answer"],
});

export class SimpleQAEvaluator extends BaseEvaluator<Item> {
  judger: SimpleQAJudger;

  config = {
    options_shuffle: true,
  };

  constructor(model: Model) {
    super(model);

    this.judger = new SimpleQAJudger(model);
  }

  question_prompt(item: Item) {
    const options = this.config.options_shuffle
      ? shuffle(item.options)
      : item.options.slice().sort();
    return [
      `问题： ${item.question}`,
      `选项：`,
      // A. xxx \n B. xxx
      ...options.map(
        (option, idx) =>
          `${String.fromCharCode("A".charCodeAt(0) + idx)}. ${option}`
      ),
    ].join("\n");
  }

  async evaluate(testcases: Item[]) {
    const results = [] as {
      input: Item;
      output: {
        explanation: string;
        answer: string;
      };
      pass: boolean;
    }[];
    let yes = 0;

    for (let i = 0; i < testcases.length; i++) {
      const q = testcases[i];
      const json_schema = mk_json_schema(q.options);
      const response = await this.model.chat_completion({
        prompt: this.question_prompt(q),
        system_prompt: SYSTEM_PROMPT,
        jsonschema: json_schema,
        config: {
          max_tokens: 1024,
          temperature: 0.2,
        },
      });
      const json_data = this.parse_json(response, {
        explanation: "[ERROR]",
        answer: "[ERROR]",
      }) as {
        explanation: string;
        answer: string;
      };
      const pass = await this.judger.judge(q.answer, json_data.answer);

      results.push({
        input: q,
        output: json_data,
        pass,
      });

      yes += pass ? 1 : 0;
      this.logProgress(i, testcases.length, q, json_data.answer, pass);
    }

    const pass_acc = (yes / testcases.length) * 100;
    // 缩放得分 基准得分为 25 (随机乱选得分 25)
    const accuracy = ((pass_acc - 25) / 75) * 100;

    return {
      pass_acc,
      accuracy,
      results,
    };
  }

  logProgress(index, total, q: Item, response, pass) {
    console.log(
      `[${index.toString().padStart(3, "0")}/${total}]`,
      pass ? "✅" : "❌",
      JSON.stringify({
        q: q.question,
        response,
      })
    );
  }
}
