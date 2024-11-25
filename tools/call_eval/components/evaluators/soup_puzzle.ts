import { BaseEvaluator } from "../evaluator";
import { CompletionJudger } from "../judgers/completion";
import { Model } from "../model";

import { mean } from "lodash-es";

type Item = { surface: string; bottom: string };

const prompts = {
  god_start: `
你正在参与一场情境猜谜游戏。
规则是：
我会讲述一个奇怪的故事描述，并且我有一个隐藏的合乎逻辑的真相。你需要通过提问的方式搜集线索，并最终猜测出真相。
你每次只能提出一个问题，必须使用疑问句。而我们的答案是“是”、“不是”或者“无关”。

- 请注意，本次会话中只会进行一轮游戏！
- 请注意由于出题者只会回复特定词语，所以你得在回复中使用疑问句，试图得到更多线索。
- 你的提问应该尽量和故事相关且简单直接。

## 故事描述
{{ surface }}

现在，请开始提问吧！
    `.trim(),
  god_reply: `
你是这场情境猜谜游戏的出题者。
规则是：
作为出题者会讲述一个奇怪的故事描述，并且有一个玩家不知道的合乎逻辑的真相。在玩家每次提出问题之后，你将用“是”、“不是”或者“无关”来回答问题。

输出要求:
1. 你需要先分析玩家的发言，然后判断玩家是否已经推测出最终真相，并给出回复
2. 请输出 JSON 格式的分析数据，其中应该包含以下数据
    - explanation: 对即将输出的回答进行解释
    - truth_distance: 玩家发言与真相的距离，用0-100的数字表示，100表示完全不相干即距离最远，0表示完全相同等于汤底即距离最近
    - message_type: 表示玩家发言的类型是提问还是尝试回答。 "question" | "reply"
    - is_final_truth: 判断玩家是否已经推测出汤底真相，以此决定是否结束游戏
    - reply: 对玩家的回复 "是" | "不是" | "无关"

## 故事描述
{{ surface }}

## 故事真相
{{ bottom }}

## 玩家发言
{{ question }}

----
现在，请针对用户的提问进行分析吧！
    `.trim(),
};

const god_reply_jsonschema = {
  type: "object",
  properties: {
    explanation: { type: "string" },
    truth_distance: { type: "number", minimum: 0, maximum: 100 },
    message_type: { type: "string", enum: ["question", "reply"] },
    is_final_truth: { type: "boolean" },
    reply: { type: "string", enum: ["是", "不是", "无关"] },
  },
  required: [
    "explanation",
    "reply",
    "is_final_truth",
    "message_type",
    "truth_distance",
  ],
  additionalProperties: false,
};

type Judged = {
  explanation: string;
  reply: "是" | "不是" | "无关";
  message_type: "question" | "reply";
  truth_distance: number;
  is_final_truth: boolean;
};

export class SoupPuzzleEvaluator extends BaseEvaluator<Item> {
  config = {
    max_turns: 30,
  };

  constructor(model: Model) {
    super(model);
  }

  async evaluate(testcases: Item[]) {
    const results = [] as {
      puzzle: Item;
      turns: number;
      pass: boolean;
      // 轮次分数，可能为0，就是完全没回答出来
      turn_score: number;
      // 距离分数，表示是否接近答案
      distance_score: number;
      messages: {
        role: "assistant" | "user";
        content: string;
        judged?: any;
      }[];
    }[];

    for (let i = 0; i < testcases.length; i++) {
      const q = testcases[i];
      const conversion = await this.one_story(q);

      const pass = !!conversion[conversion.length - 1].judged?.is_final_truth;
      const turns = conversion.length / 2;
      // 单轮分数： (max - length) / max
      const turn_score =
        Math.max(this.config.max_turns - turns, 0) / this.config.max_turns;
      // 所有距离求平均
      const assistant_msgs = conversion.filter((m) => m.role === "assistant");
      const distance_score = mean(
        assistant_msgs.map((m) => m.judged?.truth_distance ?? 0)
      );
      results.push({
        puzzle: q,
        turns,
        pass,
        turn_score,
        distance_score,
        messages: conversion,
      });

      this.logProgress(i, testcases.length, q, conversion.length, pass);
    }

    // 最终得分就是 distance_score 求平均
    const accuracy = mean(results.map((r) => r.distance_score));

    return {
      results,
      accuracy,
    };
  }

  // 单个故事的轮次
  async one_story(story: Item) {
    const { surface, bottom } = story;
    const messages = [] as {
      role: "user" | "assistant";
      content: string;
      judged?: Judged;
    }[];

    const god_judge = async (question: string) => {
      const response = await this.model.chat_completion({
        prompt: prompts.god_reply
          .replace("{{ surface }}", surface)
          .replace("{{ bottom }}", bottom)
          .replace("{{ question }}", question),
        jsonschema: god_reply_jsonschema,
        config: {
          temperature: 0.5,
          max_tokens: 4096,
        },
      });
      const json_data = this.parse_json(response);
      return json_data as Judged;
    };
    const send_to_player = async (text: string) => {
      const response = await this.model.chat_completion({
        prompt: text,
        history: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        config: {
          max_tokens: 4096,
        },
      });
      messages.push({
        role: "user",
        content: text,
      });
      const judged = await god_judge(response);
      messages.push({
        role: "assistant",
        content: response,
        judged,
      });
      console.log(
        (messages.length / 2).toString().padStart(2, "0"),
        `P> ${response.trim()}\nG> ${judged.reply} | ${judged.message_type} | ${
          judged.is_final_truth ? "final" : ""
        } | ${judged.truth_distance}`
      );
      return {
        response,
        judged,
      };
    };

    const is_end_turn = (judged: Judged) => {
      return (
        judged.is_final_truth &&
        judged.reply === "是" &&
        judged.message_type === "reply" &&
        judged.truth_distance < 33.33
      );
    };

    // 1 turn
    const t1 = await send_to_player(
      prompts.god_start
        .replace("{{ surface }}", surface)
        .replace("{{ bottom }}", bottom)
    );
    if (is_end_turn(t1.judged)) {
      return messages;
    }

    let turns = 1;
    while (true) {
      turns++;
      if (turns > this.config.max_turns) {
        break;
      }
      const last_message = messages[messages.length - 1];
      const judged = last_message.judged!;
      // 不是 question 则需要告知是否结束
      const message_text =
        judged.message_type === "reply"
          ? `${judged.reply}。\n\n（游戏没有结束，我们继续当前的游戏，你应该继续针对故事提问。）`
          : judged.reply;
      const t2 = await send_to_player(message_text);
      if (is_end_turn(t2.judged)) {
        break;
      }
    }

    return messages;
  }

  logProgress(index, total, q: Item, turns, pass) {
    console.log(
      `[${index.toString().padStart(3, "0")}/${total}]`,
      pass ? "✅" : "❌",
      JSON.stringify({
        q: q.surface,
        turns,
        pass,
      })
    );
  }
}
