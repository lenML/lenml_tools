import { mean } from "lodash-es";
import { BaseEvaluator } from "../evaluator";
import { CompletionJudger } from "../judgers/completion";
import { Model } from "../model";

type Item = { target: number };

const start_prompt = `
我们来玩一个猜数字的游戏。
规则如下：
1. 我心里有一个秘密数字，你需要通过每轮猜测来找出这个数字。
2. 每次你猜一个数字后，我会根据以下规则回答：
   - **"小了"**：表示你的猜测数字比目标数字小。
   - **"大了"**：表示你的猜测数字比目标数字大。

你应该根据上下文回复一个 JSON 格式的数据，用于表明你的思考，以及你猜测的数字。
JSON数据的中应该包含：
- explanation: 你的思考
- guess: 你猜测的数字

游戏开始：
目标数字是一个位于 **{{ min_num }}** 到 **{{ max_num }}** 范围内的整数。
现在，请输入你的第一个猜测！
`;
const jsonschema0 = {
  type: "object",
  properties: {
    explanation: { type: "string" },
    guess: { type: "number" },
  },
  required: ["explanation", "guess"],
  additionalProperties: false,
};

function trendScore(diffs: number[]) {
  if (diffs.length < 2) {
    return 1.0;
  }

  // 计算相邻点变化
  const changes = [] as number[];
  for (let i = 0; i < diffs.length - 1; i++) {
    changes.push(diffs[i + 1] - diffs[i]);
  }

  // 计算下降点比例
  const descentCount = changes.filter((x) => x < 0).length;
  const descentRatio = descentCount / changes.length;

  // 计算波动性
  const maxVal = Math.max(...diffs);
  const minVal = Math.min(...diffs);

  let volatility = 0;
  if (maxVal !== minVal) {
    const normalized = diffs.map((x) => (x - minVal) / (maxVal - minVal));
    const mean = normalized.reduce((a, b) => a + b) / normalized.length;
    const variance =
      normalized.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      normalized.length;
    volatility = Math.min(1, variance);
  }
  // 引入长度因子：值域 [0.5, 1]
  const lengthFactor = 0.5 + 0.5 * (1 / Math.sqrt(diffs.length));

  // 最终得分
  const finalScore = descentRatio * (1 - volatility * 0.5) * lengthFactor;

  return finalScore;
}

export class NumPuzzleEvaluator extends BaseEvaluator<Item> {
  system_prompt = "You are a helpful assistant.";

  config = {
    max_num: 5000,
    min_num: 0,
    max_turns: 30,
  };

  constructor(model: Model) {
    super(model);
  }

  async evaluate(testcases: Item[]) {
    const results = [] as {
      target: number;
      turn_messages: any[];
      score: number;
      pass: boolean;
      guesses: number[];
      index: number;
    }[];
    let yes = 0;

    for (let i = 0; i < testcases.length; i++) {
      const q = testcases[i];
      const response = await this.one_game(q);
      const { pass, turn_messages, guesses } = response;
      yes += pass ? 1 : 0;

      const diffs = guesses.map((x) => Math.abs(x - q.target));
      const score = trendScore(diffs);
      results.push({
        index: i,
        target: q.target,
        score,
        pass,
        guesses,
        turn_messages,
      });

      this.logProgress(i, testcases.length, q, score, pass);
    }

    const accuracy = mean(results.map((x) => x.score));

    return {
      score: accuracy * 100,
      accuracy,
      results,
    };
  }

  // 一轮游戏
  async one_game(item: Item) {
    const { target } = item;

    const guesses = [] as number[];
    const turn_messages = [] as {
      user: {
        content: string;
      };
      assistant: {
        content: string;
        explanation: string;
        guess: number;
      };
    }[];
    const send_to_player = async (text: string) => {
      const response = await this.model.chat_completion({
        prompt: text,
        history: [
          ...turn_messages
            .map((m) => {
              return [
                {
                  role: "user",
                  content: m.user.content,
                },
                {
                  role: "assistant",
                  content: `我猜数字是: ${m.assistant.guess}`,
                },
              ];
            })
            .flat(),
          {
            role: "user",
            content: text,
          },
        ] as any[],
        system_prompt: this.system_prompt,
        jsonschema: jsonschema0,
        config: {
          max_tokens: 4096,
          temperature: 0.2,
        },
      });
      let { guess, explanation } = this.parse_json(response, {
        guess: 0,
        explanation: "[ERROR]",
      });
      if (explanation === "[ERROR]") {
        // 尝试从 response 中找到数字
        const match = response.match(/\d+/);
        if (match) {
          try {
            const n = parseInt(match[0]);
            if (Number.isFinite(n)) {
              guess = n;
            }
          } catch (error) {
            // pass
          }
          // explanation = "";
        }
      }

      turn_messages.push({
        user: {
          content: text,
        },
        assistant: {
          content: response,
          explanation,
          guess,
        },
      });
      console.log(
        turn_messages.length.toString().padStart(2, "0"),
        `P> ${explanation.trim()}\nG> ${guess} | ${guess - target}`
      );
      guesses.push(guess);
      return {
        response,
        guess: guess,
      };
    };

    let last_turn = await send_to_player(
      start_prompt
        .replace("{{ min_num }}", this.config.min_num.toString())
        .replace("{{ max_num }}", this.config.max_num.toString())
    );

    let turns = 0;
    while (true) {
      turns += 1;
      if (turns > this.config.max_turns) {
        break;
      }
      if (last_turn.guess === target) {
        return {
          turn_messages,
          pass: true,
          guesses,
        };
      }
      if (!Number.isFinite(last_turn.guess)) {
        last_turn = await send_to_player(
          "错误的猜测，继续游戏，你应该继续猜测"
        );
      } else if (last_turn.guess < target) {
        last_turn = await send_to_player("小了");
      } else {
        last_turn = await send_to_player("大了");
      }
    }
    return {
      turn_messages,
      pass: false,
      guesses,
    };
  }

  logProgress(index, total, q: Item, score, pass) {
    console.log(
      `[${index.toString().padStart(3, "0")}/${total}]`,
      pass ? "✅" : "❌",
      JSON.stringify({
        target: q.target,
        score,
        pass,
      })
    );
  }
}
