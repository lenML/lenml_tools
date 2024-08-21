import { InMemoryDataset } from "./Dataset";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const Features = {
  identity: {
    write(data: any) {
      return data;
    },
    read(data: any) {
      return data;
    },
  },
  file_buffer: {
    write(filepath: string, data: NodeJS.ArrayBufferView) {
      fs.writeFileSync(filepath, data);
      return filepath;
    },
    read(filepath: string) {
      return fs.readFileSync(filepath);
    },
  },
  file_text: {
    write(filepath: string, data: string) {
      fs.writeFileSync(filepath, data);
      return filepath;
    },
    read(filepath: string) {
      return fs.readFileSync(filepath).toString("utf-8");
    },
  },
};

export class FolderDataset {
  static metadata_filename = "metadata.json";

  handler = new InMemoryDataset<
    {
      id: string;
      image: string;
      prompt: string;
      // json
      info: any;
    },
    {
      id: string;
      image: Buffer;
      prompt: string;
      info: any;
    }
  >({
    data: [],
    features: {
      id: Features.identity,
      info: Features.identity,
      image: Features.file_buffer,
      prompt: Features.file_text,
    },
  });

  constructor(
    readonly options: {
      dir_path: string;
    }
  ) {
    if (!fs.existsSync(options.dir_path)) {
      throw new Error("Directory not found: " + options.dir_path);
    }

    this.load_metadata();
    this.save_metadata();
  }

  get_all_prompts() {
    const feature = this.handler.features.prompt;
    return this.handler.data.map((item) => feature.read(item.prompt));
  }

  protected load_metadata() {
    const metadata_path = path.join(
      this.options.dir_path,
      FolderDataset.metadata_filename
    );
    if (fs.existsSync(metadata_path)) {
      const metadata = JSON.parse(fs.readFileSync(metadata_path, "utf8"));
      this.handler.data = metadata;
    } else {
      console.log("No metadata file found");
    }
  }

  protected save_metadata() {
    const metadata_path = path.join(
      this.options.dir_path,
      FolderDataset.metadata_filename
    );
    fs.writeFileSync(metadata_path, JSON.stringify(this.handler.data));
  }

  addImage({
    info,
    data,
    prompt,
  }: {
    data: Buffer;
    prompt: string;
    info: any;
  }) {
    const { dir_path } = this.options;
    const id = uuidv4();
    const filename = `${id}.png`;
    const prompt_filename = `${id}.txt`;
    const row = {
      data: {
        id,
        info,
        image: data,
        prompt,
      },
      item: {
        id,
        info,
        image: path.join(dir_path, filename),
        prompt: path.join(dir_path, prompt_filename),
      },
    };
    this.handler.addItem(row.data, row.item);
    this.save_metadata();
  }
}
