import fs from "fs";
import readline from "readline";
import * as csv from "csv";

class ListLoader<T> {
  constructor(readonly filepath: string) {}

  async load(): Promise<T[]> {
    throw new Error("Method not implemented.");
  }
}

export class TextLinesLoader extends ListLoader<string> {
  async load(): Promise<string[]> {
    const lines = await fs.promises.readFile(this.filepath, "utf-8");
    return lines
      .split("\n")
      .filter((line) => line.trim() !== "" && !line.startsWith("#"));
  }
}

export class JsonLinesLoader<T> extends ListLoader<T> {
  async load(): Promise<T[]> {
    const rows = [] as T[];
    const rl = readline.createInterface({
      input: fs.createReadStream(this.filepath),
    });
    for await (const line of rl) {
      if (line.trim() === "") continue;
      try {
        rows.push(JSON.parse(line));
      } catch (error) {
        console.error(error);
      }
    }
    return rows;
  }
}

export class JsonArrayLoader<T> extends ListLoader<T> {
  async load(): Promise<T[]> {
    const content = await fs.promises.readFile(this.filepath, "utf-8");
    const data = JSON.parse(content);
    const array_like = [
      data,
      data.prompts,
      data.list,
      data.items,
      data.data,
    ].reduce((acc, cur) => {
      if (Array.isArray(acc)) return acc;
      if (Array.isArray(cur)) return cur;
      return acc;
    }, null);
    if (!Array.isArray(array_like)) {
      throw new Error("data is not an array");
    }
    return array_like;
  }
}

export class CsvLoader<T> extends ListLoader<T> {
  async load(): Promise<T[]> {
    const rows: T[] = [];
    const parser = fs.createReadStream(this.filepath).pipe(
      csv.parse({
        /* ... */
      })
    );
    for await (const record of parser) {
      rows.push(record);
    }
    return rows;
  }
}
