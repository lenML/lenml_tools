import { mean } from "lodash-es";
import { BaseEvaluator } from "../evaluator";
import { CompletionJudger } from "../judgers/completion";
import { Model } from "../model";

type Item = { target: number };

const start_prompt = `
我们来玩一个游戏，这个游戏叫做猜数字。
规则：我有一个数字不能直接说出来，你通过每轮猜测的形式确定这个数字是多少。我只能回答你"大了"还是"小了"或者"正确"。
- 小了：表示你猜测的数字小于目标数字
- 大了：表示你猜测的数字大于目标数字
- 正确：即游戏胜利猜测正确

现在，游戏开始：
这个数字范围在{{ min_num }}到{{ max_num }}之间的整数。
`;

function trendScore(numbers: number[]) {
  if (numbers.length < 2) {
    return 1.0;
  }

  // 计算相邻点变化
  const changes = [] as number[];
  for (let i = 0; i < numbers.length - 1; i++) {
    changes.push(numbers[i + 1] - numbers[i]);
  }

  // 计算下降点比例
  const descentCount = changes.filter((x) => x < 0).length;
  const descentRatio = descentCount / changes.length;

  // 计算波动性
  const maxVal = Math.max(...numbers);
  const minVal = Math.min(...numbers);

  let volatility = 0;
  if (maxVal !== minVal) {
    const normalized = numbers.map((x) => (x - minVal) / (maxVal - minVal));
    const mean = normalized.reduce((a, b) => a + b) / normalized.length;
    const variance =
      normalized.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      normalized.length;
    volatility = Math.min(1, variance);
  }

  // 最终得分
  const finalScore = descentRatio * (1 - volatility * 0.5);

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
      messages: any;
      score: number;
      pass: boolean;
      guesses: number[];
      index: number;
    }[];
    let yes = 0;

    for (let i = 0; i < testcases.length; i++) {
      const q = testcases[i];
      const response = await this.one_game(q);
      const { pass, messages, guesses } = response;
      yes += pass ? 1 : 0;

      const diffs = guesses.map((x) => Math.abs(x - q.target));
      const score = trendScore(diffs);
      results.push({
        index: i,
        target: q.target,
        score,
        pass,
        guesses,
        messages,
      });

      this.logProgress(i, testcases.length, q, score, pass);
    }

    return {
      results,
      accuracy: mean(results.map((x) => x.score)),
    };
  }

  // 一轮游戏
  async one_game(item: Item) {
    const { target } = item;

    const guesses = [] as number[];
    const messages = [] as {
      role: "user" | "assistant";
      content: any;
      guess?: number;
    }[];
    const send_to_player = async (text: string) => {
      const response = await this.model.chat_completion({
        prompt: text,
        history: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        system_prompt: this.system_prompt,
        config: {
          max_tokens: 4096,
        },
      });
      const guess = Number(response.match(/\d+/)?.reverse()[0]);
      messages.push({
        role: "user",
        content: text,
      });
      messages.push({
        role: "assistant",
        content: response,
        guess: guess,
      });
      console.log(
        (messages.length / 2).toString().padStart(2, "0"),
        `P> ${response.trim()}\nG> ${guess} | ${guess - target}`
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
          messages,
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
      messages,
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
