import { BaseJudger } from "../judger";

export class CompletionJudger extends BaseJudger<
  {
    question: string;
    answer: string[];
  },
  boolean
> {
  async judge(
    prompt: { question: string; answer: string[] },
    response: string
  ): Promise<boolean> {
    const flags = prompt.answer.map((ans) => response.startsWith(ans));
    const pass = flags.some((flag) => flag);
    return pass;
  }
}
