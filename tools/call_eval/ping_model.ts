import "./preload";

import fs from "fs";
import path from "path";

import { Model } from "./components/model";
import { current_model } from "./args";

async function main() {
  const model = current_model;
  console.time("generating");
  const resp = await model.chat_completion({
    prompt: "请回复: 测试成功.",
    system_prompt: "You are a helpful assistant.",
    callback(text, data, resp) {
      console.log(JSON.stringify(data));
      console.log("----");
      console.log(text);
    },
  });
  console.timeEnd("generating");
  //   console.log(resp);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
