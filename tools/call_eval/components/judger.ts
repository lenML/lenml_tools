import { Model } from "./model";

export class BaseJudger<PromptItem, Result> {
  model: Model;

  constructor(model: Model) {
    this.model = model;
  }

  async judge(prompt: PromptItem, response: string): Promise<Result> {
    throw new Error("需要实现judge方法");
  }
}
