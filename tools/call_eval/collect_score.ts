import fs from "fs";
import path from "path";

const [model_name] = process.argv.slice(2);
if (!model_name) {
  console.error("Usage: node collect_score.js <model_name>");
  process.exit(1);
}

// 通用读取和解析函数，处理文件不存在时返回默认值
const readJSONFile = (filepath: string, defaultValue: any = {}) => {
  try {
    const data = fs.readFileSync(filepath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      // 文件不存在，返回默认值
      return defaultValue;
    }
    throw error; // 其他错误抛出
  }
};

// 生成文件路径的工具函数
const getFilePath = (subfolder: string, name: string) =>
  path.join(__dirname, "results", subfolder, `${name}.json`);

// 定义结果解析器
const result_resolvers = {
  hardcore: (name: string) => {
    const filepath = getFilePath("hardcore", name);
    const data = readJSONFile(filepath, { accuracy: null });
    return { l_hardcore: data.accuracy };
  },
  reject: (name: string) => {
    const filepath = getFilePath("reject", name);
    const data = readJSONFile(filepath, { score: null });
    return { l_reject_rv: data.score };
  },
  creative: (name: string) => {
    const filepath = getFilePath("creative", name);
    const data = readJSONFile(filepath, {
      final_scores: { long_score: null, creative_score: null },
    });
    return {
      l_long: data.final_scores.long_score,
      l_creative: data.final_scores.creative_score,
    };
  },
  num_puzzle: (name: string) => {
    const filepath = getFilePath("num_puzzle", name);
    const data = readJSONFile(filepath, { score: null });
    return { l_np: data.score };
  },
  acg01: (name: string) => {
    const filepath = getFilePath("acg01", name);
    const data = readJSONFile(filepath, { accuracy: null });
    return { l_acg: data.accuracy };
  },
};

// 合并结果
const result = Object.values(result_resolvers).reduce(
  (acc, resolver) => ({
    ...acc,
    ...resolver(model_name),
  }),
  {}
);

console.log(JSON.stringify(result, null, 2));
