import { BaseEvaluator } from "../evaluator";
import { CompletionJudger } from "../judgers/completion";
import { Model } from "../model";

type Item = { question: string; answer: string[] };

export class CompletionEvaluator extends BaseEvaluator<Item> {
  judger: CompletionJudger;

  constructor(model: Model) {
    super(model);

    this.judger = new CompletionJudger(model);
  }

  async evaluate(testcases: Item[]) {
    const results = [] as {
      question: string;
      response: string;
      pass: boolean;
      index: number;
    }[];
    let yes = 0;

    for (let i = 0; i < testcases.length; i++) {
      const q = testcases[i];
      const response = await this.model.completion({
        prompt: q.question,
        params: {
          temperature: 1,
          max_tokens: 5,
          top_p: 0.2,
          presence_penalty: 0.4,
          frequency_penalty: 0.4,
        },
      });
      const pass = await this.judger.judge(q, response);

      results.push({
        question: q.question,
        response,
        pass,
        index: i,
      });

      yes += pass ? 1 : 0;
      this.logProgress(i, testcases.length, q, response, pass);
    }

    return {
      accuracy: (yes / testcases.length) * 100,
      results,
    };
  }

  logProgress(index, total, q: Item, response, pass) {
    console.log(
      `[${index.toString().padStart(3, "0")}/${total}]`,
      pass ? "✅" : "❌",
      JSON.stringify({
        q,
        response,
        pass,
      })
    );
  }
}
