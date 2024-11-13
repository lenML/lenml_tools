import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:1234/v1";

const createChatCompletions = async ({
  model = "gpt-3.5-turbo",
  prompt = "Say this is a test",
  system_prompt = "You are a helpful assistant.",
  max_tokens = -1,
  temperature = 0.75,
  top_p = 1.0,
  frequency_penalty = 0.0,
  presence_penalty = 0.0,
} = {}) => {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system_prompt },
        { role: "user", content: prompt },
      ],
      max_tokens,
      temperature,
      top_p,
      frequency_penalty,
      presence_penalty,
      stream: false,
    }),
  });
  const data = await response.json();
  return data;
};

// 执行脚本 读取 prompt.txt system_prompt.txt 文本，作为 prompt 然后调用
async function main() {
  const system_prompt = await fs.promises.readFile("system.txt", "utf8");
  const prompt = await fs.promises.readFile("prompt.txt", "utf8");
  console.log({ system_prompt, prompt });
  const response = await createChatCompletions({ prompt, system_prompt });

  if (response.error) {
    console.error("[ERROR]");
    console.error(response.error);
    return;
  }

  const { id, object, created, model, choices, usage } = response;
  console.log("usage:", usage);

  const {
    index,
    message: { role, content },
    finish_reason,
  } = choices[0];
  console.log(role, `(${finish_reason})>>`, content);
}

main().catch((err) => console.error(err));
