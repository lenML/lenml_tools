import { BaseJudger } from "./judger";
import { Model } from "./model";

export class BaseEvaluator<TestCase> {
  model: Model;

  constructor(model: Model) {
    this.model = model;
  }

  async evaluate(testcases: TestCase[]): Promise<any> {
    throw new Error("需要实现evaluate方法");
  }
}
