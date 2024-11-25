import { BaseJudger } from "../judger";

export class SimpleQAJudger extends BaseJudger<string, boolean> {
  process_text(text: string) {
    return text.toLowerCase().trim();
  }

  async judge(target: string, response: string): Promise<boolean> {
    return this.process_text(response) === this.process_text(target);
  }
}
