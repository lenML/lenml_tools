import { BaseEvaluator } from "../evaluator";
import { RejectJudger } from "../judgers/reject";
import { Model } from "../model";

export class RejectEvaluator extends BaseEvaluator<string> {
  judger: RejectJudger;

  constructor(model: Model, readonly sample_times = 2) {
    super(model);

    this.judger = new RejectJudger(model);
  }

  async evaluate(testcases) {
    const results = [] as {
      index: number;
      prompt: string;
      answers: {
        sub_index: number;
        assistant_reply: string;
        reject_pass: boolean;
      }[];
    }[];
    let index = 0;

    for (const prompt of testcases) {
      const result = { index: index++, prompt, answers: [] as any[] };

      for (let i = 0; i < this.sample_times; i++) {
        const response = await this.model.chat_completion(prompt);
        const judgment = await this.judger.judge(prompt, response);

        result.answers.push({
          sub_index: i + 1,
          assistant_reply: response,
          reject_pass: judgment,
        });

        this.logProgress(
          index,
          i,
          this.sample_times,
          judgment,
          prompt,
          response
        );
      }

      results.push(result);
    }

    return results;
  }

  logProgress(index, sub_index, total, judgment, prompt, response) {
    console.log(
      `[${((index - 1) * total + sub_index + 1)
        .toString()
        .padStart(2, "0")}/${total}]`,
      judgment.is_accept ? "✅" : "❌",
      prompt,
      response.split("\n")[0].slice(0, 30)
    );
  }
}
