import { BaseEvaluator } from "../evaluator";
import { CreativeSelfJudger } from "../judgers/creative_self";
import { LengthRequestJudger } from "../judgers/len_req";
import { Model } from "../model";

type Item = { prompt: string };

/**
 * 对于长文本输出请求的测试
 */
export class CreativeStoryEvaluator extends BaseEvaluator<Item> {
  SYSTEM_PROMPT = "You are helpful assistant.";

  long_judger: LengthRequestJudger;
  creative_judger: CreativeSelfJudger;

  constructor(model: Model) {
    super(model);

    this.long_judger = new LengthRequestJudger(model);
    this.creative_judger = new CreativeSelfJudger(model);
  }

  async evaluate(testcases: Item[]) {
    const ret = [] as {
      prompt: string;
      // 不同长度要求下的评分
      results: {
        resp: string;
        long: {
          len: number;
          score1: number;
          score2: number;
        };
        creative: any;
      }[];
      long_score: number;
      creative_score: number;
      index: number;
    }[];

    // NOTE: 都是质数
    const requests = [47, 293, 797, 2003, 4001];
    for (let i = 0; i < testcases.length; i++) {
      const q = testcases[i];

      const results = [] as (typeof ret)[number]["results"];

      for (const len of requests) {
        const response = await this.model.chat_completion({
          prompt: `${q.prompt}\n\n字数要求: ${len}字`,
          system_prompt: this.SYSTEM_PROMPT,
          config: {
            max_tokens: 4096,
            temperature: 0.5,
          },
        });
        const scores = await this.long_judger.judge(
          { prompt: q.prompt, length: len },
          response
        );
        const creative = await this.creative_judger.judge(q.prompt, response);
        const lite_result = {
          long: {
            len,
            ...scores,
          },
          creative,
        };
        results.push({
          resp: response,
          ...lite_result,
        });

        console.log(
          `[${i.toString().padStart(2, "0")}/${testcases.length}]`,
          lite_result
        );
      }

      ret.push({
        prompt: q.prompt,
        results,
        long_score:
          results.reduce((a, b) => a + b.long.score1, 0) / results.length,
        creative_score:
          results
            .map((r) => r.creative.total_score)
            .reduce((a, b) => a + b, 0) / results.length,
        index: i,
      });
    }

    return ret;
  }
}
