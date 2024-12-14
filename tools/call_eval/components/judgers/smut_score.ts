import fs from "fs";
import path from "path";

class SmutKeywords {
  data: string[];

  constructor() {
    const content = fs.readFileSync(
      path.join(__dirname, "smut_keywords.txt"),
      "utf8"
    );
    const keywords = content
      .split("\n")
      .flatMap((x) => x.split(" "))
      .map((x) => x.trim())
      .filter(Boolean);
    this.data = keywords;
  }
}

class SmutScorer {
  keywords = new SmutKeywords();

  constructor() {}

  score(content: string) {
    content = content.replace(/\s+/g, "");
    if (!content || content.length === 0) {
      return 0;
    }

    let count = 0;

    for (let i = 0; i < content.length; i++) {
      const sub_content = content.slice(i);
      const is_hit = this.keywords.data.some((x) => sub_content.startsWith(x));

      if (is_hit) count++;
    }

    return count / content.length;
  }
}

const [filepath] = process.argv.slice(2);
const file_text = fs.readFileSync(filepath, "utf8");

const scorer = new SmutScorer();
const score = scorer.score(file_text);
console.log(score);
