import { parse_json } from "./misc/parse_json";
import { Model } from "./model";

export class BaseJudger<PromptItem, Result> {
  model: Model;

  constructor(model: Model) {
    this.model = model;
  }

  async judge(prompt: PromptItem, response: string): Promise<Result> {
    throw new Error("需要实现judge方法");
  }

  parse_json(text: string, fallback?: any) {
    return parse_json(text, fallback);
  }
}
