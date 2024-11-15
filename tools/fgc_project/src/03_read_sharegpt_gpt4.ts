import * as fs from "fs";
import * as readline from "readline";
import { franc, francAll } from "franc";

// 定义结构
interface Conversation {
  from: string;
  value: string;
}

interface DataRow {
  conversations: Conversation[];
}

// 读取文件并提取 instruction
async function extractInstructions(filePath: string): Promise<string[]> {
  const instructions: string[] = [];

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    try {
      // 解析每行 JSON 数据
      const data: DataRow = JSON.parse(line);

      // 提取 'instruction'
      const instruction = data.conversations.find(
        (conv) => conv.from === "human"
      )?.value;
      if (instruction) {
        instructions.push(instruction);
      }
    } catch (error) {
      console.error("Error parsing line:", error);
    }
  }

  return instructions;
}

// 主函数
async function main() {
  const filePath = "./temp_data/sharegpt_gpt4.jsonl";
  const instructions = await extractInstructions(filePath);

  // 输出结果
  console.log("Extracted Instructions:", instructions.length);

  const instructions_full = await Promise.all(
    instructions.map(async (x) => {
      const language = await franc(x);
      return {
        text: x,
        lang: language,
      };
    })
  );

  // 可以将结果写入到文件中
  fs.writeFileSync(
    "instructions.json",
    JSON.stringify(instructions_full, null, 2)
  );
}

main().catch((error) => console.error("Error:", error));
