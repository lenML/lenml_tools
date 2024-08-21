import "dotenv/config";
import "./preload";
import {
  CivitaiRESTAPIClient,
  ImagesResponse,
} from "@stable-canvas/civitai-rest-api-client";
import {
  PromptParser,
  generation_str,
} from "@stable-canvas/sd-webui-a1111-prompt-parser";

import fs from "fs";
import path from "path";
import { Command } from "commander";

function parse_opts() {
  const program = new Command();
  program.version("0.0.1");

  // 查询参数 + format输出格式
  program
    .option("-l, --limit <limit>", "The number of images to retrieve", "100")
    .option(
      "-m, --model_id <model_id>",
      "The model to retrieve images from",
      "257749"
    )
    .option(
      "-mv, --model_version <model_version>",
      "The model version to retrieve images from",
      "290640"
    )
    .option("-n, --nsfw <nsfw>", "The NSFW filter to retrieve images from", "X")
    .option(
      "-s, --sort <sort>",
      "The sort order to retrieve images from",
      "Most Reactions"
    )
    .option(
      "-p, --period <period>",
      "The period to retrieve images from",
      "AllTime"
    )
    .option(
      "-pg, --page_n <page_n>",
      "The page number to retrieve images from",
      "1"
    )
    // -f --format <format> 选择输出格式 jsonl json txt csv
    .option(
      "-f, --format <format>",
      "The format to retrieve images from",
      "jsonl"
    )
    .option(
      "-o, --output_file <output_file>",
      "The output file to write the images to",
      "output_prompts.jsonl"
    )
    // 移除 weight
    .option("-rw, --remove_weight", "Remove the weight of the images")
    // 移除 lora
    .option("-rl, --remove_lora", "Remove the lora of the images")
    .option("-on, --only_nsfw", "Only retrieve NSFW images")
    .option("-ow, --overwrite", "Overwrite the output file if it exists");

  program.parse(process.argv);
  const opts = program.opts();
  const {
    limit,
    model_id,
    model_version,
    nsfw,
    sort,
    period,
    format,
    output_file,
    remove_weight,
    remove_lora,
    page_n,
    overwrite,
  } = opts;

  Object.entries({
    limit,
    model_id,
    model_version,
    page_n,
  }).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }
    if (isNaN(Number(value))) {
      throw new Error(`${key} must be a number`);
    }
    opts[key] = Number(value);
  });

  if (!overwrite && fs.existsSync(output_file)) {
    throw new Error(`The output file ${output_file} already exists`);
  }

  if (0 > limit) {
    throw new Error("limit must be a positive number");
  }

  if (200 < limit) {
    throw new Error("limit must be less than or equal to 200");
  }

  return opts as {
    limit: number;
    model_id: number;
    model_version: number;
    nsfw: string;
    sort: string;
    period: string;
    format: string;
    output_file: string;
    remove_lora: boolean;
    remove_weight: boolean;
    page_n: number;
    only_nsfw: boolean;
  };
}

function build_file_content(
  images: ImagesResponse,
  format: "json" | "jsonl" | "txt" | "csv",
  remove_lora: boolean,
  remove_weight: boolean
) {
  const prompts =
    images.items?.map((x) => ({
      id: x.id,
      width: x.width,
      height: x.height,
      prompt: normalize_prompt(x.meta?.prompt, {
        remove_lora,
        remove_weight,
      }),
      negative: normalize_prompt(x.meta?.negativePrompt, {
        remove_lora,
        remove_weight,
      }),
    })) ?? [];

  let content = "";

  switch (format) {
    case "txt": {
      content = prompts.map((x) => x.prompt).join("\n");
      break;
    }
    case "json": {
      content = JSON.stringify(prompts, null, 2);
      break;
    }
    case "jsonl": {
      content = prompts.map((x) => JSON.stringify(x)).join("\n");
      break;
    }
    case "csv": {
      const headers = Object.keys(prompts[0]);
      const _warper = (txt: string) =>
        txt.includes(",") ? '"""' + txt + '"""' : txt;
      content =
        headers.join(",") +
        "\n" +
        prompts
          .map((x) =>
            headers
              .map((h) => x[h])
              .map(_warper)
              .join(",")
          )
          .join("\n");
      break;
    }
  }

  return content;
}

function normalize_prompt(
  prompt: string,
  {
    remove_lora,
    remove_weight,
  }: {
    remove_lora: boolean;
    remove_weight: boolean;
  }
) {
  prompt = (prompt ?? "").trim();

  if (prompt === "") {
    return prompt;
  }

  const parser = new PromptParser();
  let nodes = [] as any[];
  try {
    nodes = parser.parse(prompt, {
      force: true,
    });
  } catch (error) {
    console.error(error);
    console.error(`Failed to parse prompt: ${prompt}`);
    process.exit(1);
  }

  function map_flat_node(node: any) {
    switch (node.type) {
      case "extra_networks": {
        if (remove_lora) return null;
        break;
      }
      case "positive": {
        if (remove_weight) return node.args.map(map_flat_node);
        break;
      }
      case "negative": {
        if (remove_weight) return node.args.map(map_flat_node);
        break;
      }
      case "weighted": {
        if (remove_weight) return node.args.map(map_flat_node);
        break;
      }
      case "scheduled_to": {
        if (remove_weight) {
          return node.args.map(map_flat_node);
        }
        break;
      }
      case "scheduled_from": {
        if (remove_weight) {
          return node.args.map(map_flat_node);
        }
        break;
      }
      case "scheduled_full": {
        if (remove_weight) {
          return node.args.map(map_flat_node);
        }
        break;
      }
    }
    return node;
  }

  nodes = nodes.map(map_flat_node).flat(64).filter(Boolean) as any[];

  try {
    return generation_str(nodes, { remove_1_weighted: true });
  } catch (error) {
    console.error(error);
    console.error(`Failed to generate prompt: ${prompt}`);
    console.error(`Failed to generate nodes: ${JSON.stringify(nodes)}`);
    process.exit(1);
  }
}

async function main() {
  const client = new CivitaiRESTAPIClient();

  const {
    limit,
    model_id,
    model_version,
    nsfw,
    sort,
    period,
    format,
    output_file,
    remove_lora,
    remove_weight,
    only_nsfw,
  } = parse_opts();
  let images = await client.default.getImages({
    limit: Number(limit),
    modelId: Number(model_id),
    modelVersionId: Number(model_version),
    nsfw: nsfw as any,
    sort: sort as any,
    period: period as any,
  });

  console.log({ remove_lora, remove_weight });

  // 过滤掉没有 prompt 的
  images.items = images.items?.filter((x) => x.meta?.prompt);

  if (only_nsfw) {
    images.items = images.items?.filter((x) => x.nsfw);
  }

  // console.log(images.items?.length);

  fs.writeFileSync(
    path.join(__dirname, "..", "images_response.json"),
    JSON.stringify(images, null, 2)
  );

  fs.writeFileSync(
    path.join(process.cwd(), output_file),
    build_file_content(images, format as any, remove_lora, remove_weight)
  );
}

main().then(console.log).catch(console.error);
