import "./preload";
import fs from "fs";
import { Command } from "commander";
import { Model } from "./components/model";
const program = new Command();

program
  .name("call-eval")
  .description("LenML tools 项目中用于调用评估器的命令工具")
  .version("0.1.0")
  // --model 模型配置的文件地址
  .option("--model <string>", "模型配置的文件地址")
  // --name 报告文件的保存名
  .option("--name [string]", "报告文件的保存名", "no-name");

program.parse();

export const program_options = program.opts() as {
  model: string;
  name: string;
};

if (!fs.existsSync(program_options.model)) {
  console.error("模型配置文件不存在");
  process.exit(1);
}

export const current_model = Model.createFromFile(program_options.model);
