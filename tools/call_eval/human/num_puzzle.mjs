import { createInterface } from "readline";

/**
 *
 * @param {number[]} diffs
 * @returns
 */
function trendScore(diffs) {
  if (diffs.length < 2) {
    return 1.0;
  }

  // 计算相邻点变化
  const changes = [];
  for (let i = 0; i < diffs.length - 1; i++) {
    changes.push(diffs[i + 1] - diffs[i]);
  }

  // 计算下降点比例
  const descentCount = changes.filter((x) => x < 0).length;
  const descentRatio = descentCount / changes.length;

  // 计算波动性
  const maxVal = Math.max(...diffs);
  const minVal = Math.min(...diffs);

  let volatility = 0;
  if (maxVal !== minVal) {
    const normalized = diffs.map((x) => (x - minVal) / (maxVal - minVal));
    const mean = normalized.reduce((a, b) => a + b) / normalized.length;
    const variance =
      normalized.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      normalized.length;
    volatility = Math.min(1, variance);
  }
  // 引入长度因子：值域 [0.5, 1]
  const lengthFactor = 0.5 + 0.5 * (1 / Math.sqrt(diffs.length));

  // 最终得分
  const finalScore = descentRatio * (1 - volatility * 0.5) * lengthFactor;

  return finalScore;
}

/**
 *
 * @param {number[]} guesses
 * @param {number} target
 */
function score(guesses, target) {
  const diffs = guesses.map((x) => Math.abs(x - target));
  return trendScore(diffs);
}

// 设置终端交互接口
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 生成一个随机数
const rand_target = Math.floor(Math.random() * 5000) + 1;
let attempts = []; // 存储每次的猜测结果

console.log("猜数字游戏：请输入 1 到 5000 的数字，输入 'exit' 可退出游戏！");

function askGuess() {
  rl.question("你的猜测是：", (input) => {
    if (input.toLowerCase() === "exit") {
      console.log("游戏结束！");
      console.log("你的猜测记录：", attempts);
      console.log("Score: ", score(attempts, rand_target));
      rl.close();
      return;
    }

    const guess = parseInt(input, 10);

    if (isNaN(guess)) {
      console.log("请输入一个 1 到 100 的有效数字！");
    } else {
      attempts.push(guess);
      if (guess === rand_target) {
        console.log(`恭喜你猜对了！数字是 ${rand_target}`);
        console.log("你的猜测记录：", attempts);
        console.log("Score: ", score(attempts, rand_target));
        rl.close();
        return;
      } else if (guess < rand_target) {
        console.log("太小了！");
      } else {
        console.log("太大了！");
      }
    }

    askGuess(); // 递归调用继续猜
  });
}

const history = [
  [2500, 1000, 500, 120, 250, 300, 270, 290, 295, 299, 297, 296],
  [
    2500, 1000, 1500, 1600, 1800, 1900, 2300, 2200, 2000, 2150, 2180, 2190,
    2185, 2188, 2186,
  ],
  [2500, 1000, 800, 900, 850, 825, 815, 805, 810, 809],
  [2500, 3500, 4500, 4000, 3800, 3600, 3700, 3650, 3680],
  [
    2500, 1000, 1800, 1500, 1600, 1700, 1650, 1670, 1680, 1690, 1685, 1688,
    1686,
  ],
];

askGuess();
