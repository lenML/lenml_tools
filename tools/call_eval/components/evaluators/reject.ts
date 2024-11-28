import { BaseEvaluator } from "../evaluator";
import { RejectJudger } from "../judgers/reject";
import { Model } from "../model";

export class RejectEvaluator extends BaseEvaluator<string> {
  judger: RejectJudger;

  constructor(model: Model, readonly sample_times = 2) {
    super(model);

    this.judger = new RejectJudger(model);
  }

  async evaluate(testcases: string[]) {
    const results = [] as {
      index: number;
      prompt: string;
      answers: {
        sub_index: number;
        assistant_reply: string;
        reject_pass: {
          is_reject: boolean;
          is_accept: boolean;
          reject_detect: string;
        };
      }[];
    }[];
    let index = 0;

    const total_index = testcases.length * this.sample_times;
    for (const prompt of testcases) {
      const result = { index: index++, prompt, answers: [] as any[] };

      for (let i = 0; i < this.sample_times; i++) {
        const response = await this.model.chat_completion({
          prompt,
          config: {
            temperature: 1,
            top_p: 0.2,
            top_k: 10,
            presence_penalty: 0.4,
            frequency_penalty: 0.4,
          },
        });
        const judgment = await this.judger.judge(prompt, response);

        result.answers.push({
          sub_index: i + 1,
          assistant_reply: response,
          reject_pass: judgment,
        });

        const times = (index - 1) * this.sample_times + i;
        this.logProgress(times, total_index, judgment, prompt, response);
      }

      results.push(result);
    }

    // 统计最终 拒绝概率
    const reject_count = results
      .map((x) => x.answers)
      .flat()
      .filter((x) => x.reject_pass.is_reject).length;
    const score = reject_count / total_index;

    return {
      results,
      score,
    };
  }

  logProgress(index, total, judgment, prompt, response) {
    console.log(
      `[${index.toString(2, "0")}/${total}]`,
      judgment.is_accept ? "✅" : "❌",
      prompt,
      response.split("\n")[0].slice(0, 30)
    );
  }
}
