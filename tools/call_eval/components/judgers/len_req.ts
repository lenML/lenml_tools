import { BaseJudger } from "../judger";

export class LengthRequestJudger extends BaseJudger<
  {
    prompt: string;
    length: number;
  },
  {
    score1: number;
    score2: number;
  }
> {
  count_words(text: string): number {
    const chineseCharacters = text.match(/[\u4e00-\u9fff]/g) || [];
    const englishWords = text.match(/\b[a-zA-Z]+\b/g) || [];

    const chineseCharCount = chineseCharacters.length;
    const englishWordCount = englishWords.length;

    const totalCount = chineseCharCount + englishWordCount;

    return totalCount;
  }

  /**
   * 这个公式从 long writer 里抄过来的
   */
  score(x: number, y: number): number {
    if (y > x) {
      return 100 * Math.max(0, 1 - (y / x - 1) / 3);
    } else {
      return 100 * Math.max(0, 1 - (x / y - 1) / 2);
    }
  }

  score2(x: number, y: number): number {
    const d1 = Math.abs(x - y);
    const e1 = d1 / y;
    const k = 0.5;
    return 100 * Math.exp(-k * e1);
  }

  async judge(
    prompt: { prompt: string; length: number },
    response: string
  ): Promise<{
    score1: number;
    score2: number;
  }> {
    const length = this.count_words(response);
    const score1 = this.score(length, prompt.length);
    const score2 = this.score2(length, prompt.length);
    return {
      score1,
      score2,
    };
  }
}
