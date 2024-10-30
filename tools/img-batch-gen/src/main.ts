import * as fs from "fs";
import * as path from "path";
import { Command } from "commander";
import {
  JsonLinesLoader,
  TextLinesLoader,
  JsonArrayLoader,
  CsvLoader,
} from "./ListLoader";
import { FolderDataset } from "./FolderDataset";
import {
  FluxModel,
  GenService,
  ModelPayload,
  SD15Model,
  SDXLModel,
} from "./Services";
import { tqdm } from "@zzkit/tqdm";
import { client } from "./client";

type BackendServer = GenService<ModelPayload>;
type ImagePrompt = {
  id?: string;
  clip_text?: string;
  t5_text?: string;
  prompt?: string;
  negative?: string;
  repeat?: number;
  width?: number;
  height?: number;
};

async function load_list(filepath: string) {
  const { ext } = path.parse(filepath);
  switch (ext) {
    case ".jsonl":
      return new JsonLinesLoader<ImagePrompt>(filepath).load();
    case ".txt": {
      const data = await new TextLinesLoader(filepath).load();
      return data.map((line) => ({ prompt: line })) as ImagePrompt[];
    }
    case ".json":
      return new JsonArrayLoader<ImagePrompt>(filepath).load();
    case ".csv":
      return new CsvLoader<ImagePrompt>(filepath).load();
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

async function generate_one({
  pt,
  service,
  payload,
}: {
  pt: ImagePrompt;
  service: BackendServer;
  payload: ModelPayload;
}) {
  const info: ModelPayload = {
    ...payload,
    width: pt.width ?? payload.width,
    height: pt.height ?? payload.height,
    negative: pt.negative ?? payload.negative,
    positive: pt.prompt ?? "",
    t5_text: pt.t5_text ?? pt.prompt,
    clip_text: pt.clip_text,
  };

  try {
    const result = await service.generate(info);
    if (!(result.image instanceof Buffer)) {
      console.error(`Empty image: ${pt.prompt}`);
      return null;
    }
    const prompt = pt.prompt ?? pt.t5_text ?? pt.clip_text ?? "";
    return {
      data: result.image,
      info,
      prompt,
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function generate_loop({
  dataset,
  prompts,
  service,
  payload,
}: {
  dataset: FolderDataset;
  prompts: ImagePrompt[];
  service: BackendServer;
  payload: ModelPayload;
}) {
  // 根据 repeat 来重复组成生成数组
  const generate_prompts = prompts.flatMap((pt) => {
    const repeat = pt.repeat ?? 1;
    return Array(repeat).fill(pt) as ImagePrompt[];
  });
  for (const pt of tqdm(generate_prompts, { desc: "Generate" })) {
    const result = await generate_one({
      pt,
      service,
      payload,
    });
    if (result) {
      dataset.addImage(result);
    }
  }
}

function parse_opts() {
  const program = new Command();
  program.version("0.0.1");

  program
    .option(
      "-l, --list_file <list_file>",
      "The list of prompts to generate dataset"
    )
    .option("-d, --dataset_dir <dataset_dir>", "The directory of dataset")
    .option("-ad, --allow_duplicate", "Allow duplicate prompts")
    // model 可以选择 flux sd15 sdxl
    .option("-m, --model <model>", "The model to generate dataset", "sd15")
    .option("-s, --shuffle", "Shuffle the prompts", false)
    // 移除 negative
    .option("-nn, --no_negative", "Remove negative prompts", false);
  program.parse(process.argv);

  const {
    list_file,
    dataset_dir,
    allow_duplicate,
    model,
    no_negative,
    shuffle,
  } = program.opts();
  if (!list_file) {
    console.error("Please specify the list of prompts to generate dataset");
    process.exit(1);
  }
  if (!dataset_dir) {
    console.error("Please specify the directory of dataset");
    process.exit(1);
  }
  if (!fs.existsSync(list_file)) {
    console.error("The list of prompts to generate dataset does not exist");
    process.exit(1);
  }
  if (!fs.existsSync(dataset_dir)) {
    fs.mkdirSync(dataset_dir, { recursive: true });
  }

  return {
    list_file,
    dataset_dir,
    allow_duplicate,
    model,
    no_negative,
    shuffle,
  } as {
    list_file: string;
    dataset_dir: string;
    allow_duplicate: boolean;
    model: string;
    no_negative: boolean;
    shuffle: boolean;
  };
}

/**
 * 这个程序用于生成数据集
 *
 * 输入 prompt 列表，然后根据列表调用后端服务生成数据集
 *
 * main.js --list_file "prompts.jsonl" --dataset_dir "./dataset1"
 */
async function main() {
  const {
    list_file,
    dataset_dir,
    allow_duplicate,
    model,
    no_negative,
    shuffle,
  } = parse_opts();

  const list_data = await load_list(list_file);
  console.log(`Loaded ${list_data.length} prompts from ${list_file}`);
  if (list_data.length === 0) {
    console.error("The list of prompts to generate dataset is empty");
    process.exit(1);
  }

  const dataset1 = new FolderDataset({
    dir_path: dataset_dir,
  });
  console.log(
    `load dataset from ${dataset_dir}, found ${dataset1.handler.length} items`
  );
  const history_prompts = dataset1.get_all_prompts();
  const prompts = list_data
    .filter((p) => {
      if (allow_duplicate) return true;
      return !history_prompts.includes(p.prompt ?? p.t5_text ?? p.clip_text);
    })
    .map((p) => {
      if (no_negative) {
        p.negative = "";
      }
      return p;
    });

  const service =
    {
      sd15: new SD15Model(),
      sdxl: new SDXLModel(),
      flux: new FluxModel(),
    }[model] ?? new FluxModel();
  const negative =
    {
      sd15: "worst quality, bad anatomy, embedding:NG_DeepNegative_V1_75T",
      sdxl: "worst quality, bad anatomy, embedding:DeepNegative_xl_v1",
      flux: "",
    }[model] ?? "worst quality, bad anatomy";

  try {
    await generate_loop({
      dataset: dataset1,
      prompts,
      service,
      payload: {
        steps: 35,
        cfg: 7,
        sampler_name: "dpmpp_3m_sde_gpu",
        scheduler: "karras",
        denoise: 1,
        width: 640,
        height: 960,
        positive: "",
        negative: negative,
      },
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    client.disconnect();
    client.close();
  }
  process.exit(0);
}

main()
  .then(console.log)
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

`
examples:

npx tsx ./src/main.ts -l "./prompts.example.txt" -d "./dataset_example"
npx tsx ./src/main.ts -l "./prompts_pony_90.jsonl" -d "./dataset_pony_90" -m "sdxl"
npx tsx ./src/main.ts -l "./prompts_pony_90.jsonl" -d "./dataset_pony_90_nn" -m "sdxl" --no_negative
npx tsx ./src/main.ts -l "./prompts_pony_bad.jsonl" -d "./dataset_pony_bad" -m "sdxl"
`;
