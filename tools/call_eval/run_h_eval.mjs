// 一个极其简单的 eval 脚本，通过调用 `/v1/completions` 接口来测评续写能力

import fs from "fs";
import path from "path";

const BASE_URL = "http://127.0.0.1:1234";

const MODEL_CONFIG = {
  model: "chatgpt-3.5",
  temperature: 1,
  max_tokens: 5,
  top_p: 0.2,
  presence_penalty: 0.4,
  frequency_penalty: 0.4,
  //   top_k: 10,
};

/**
 *
 * @param {string} prompt
 */
async function createCompletions(prompt) {
  const resp = await fetch(`${BASE_URL}/v1/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...MODEL_CONFIG,
      prompt,
    }),
  });

  const json = await resp.json();
  if (json.error) {
    throw new Error(json.error);
  }
  const text = json.choices[0].text;
  return text;
}

function loadJson(filepath) {
  return JSON.parse(fs.readFileSync(filepath));
}

async function main() {
  const eval_data = loadJson(path.join(process.cwd(), "h_eval.json"));

  // python 翻译为 js
  let yes = 0;
  let index = 0;
  for (const q of eval_data) {
    index += 1;
    const question = q.question;
    const answer = await createCompletions(question);
    const flags = q.answer.map((ans) => answer.startsWith(ans));
    const pass = flags.some((flag) => flag);

    yes += pass ? 1 : 0;

    console.log(
      `[${index.toString().padStart(3, "0")}/${eval_data.length}]`,
      pass ? "✅" : "❌",
      JSON.stringify({
        question,
        answer,
        answers: q.answer,
        flags,
        pass,
      })
    );
  }

  console.log((yes / (eval_data.length + 1)) * 100);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
