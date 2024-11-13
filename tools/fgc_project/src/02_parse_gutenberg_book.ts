import Chinese from "chinese-s2t";

export interface IChapter {
  toc: string;
  title: string;
  content: string;
}

export interface IBookParseResult {
  metadata: Record<string, any>;
  chapters: IChapter[];
}

/**
 * 解析古腾堡项目中的中文图书
 *
 * 并解析为章节
 * 同时繁体转简体
 * 并进行段落合并
 * （因为来源可能是小说网站，导致很多段落是分割开的）
 */
export class GutenbergBookParser {
  lines = [] as string[];
  constructor(readonly content: string) {
    // 繁体转简体
    this.content = Chinese.t2s(content);
    this.lines = this.content.split("\n");
  }

  parse(): IBookParseResult {
    const body_start = this.locateStart();
    const body_end = this.locateEnd();

    // 如果找不到就直接当作一个章节
    if (body_end === -1 || body_start === -1) {
      return {
        metadata: {},
        chapters: [
          {
            toc: "",
            title: "",
            content: this.content,
          },
        ],
      };
    }

    const chapters = this.findChapters(body_start, body_end);
    const metadata = this.parseMetadata(body_start);

    return {
      metadata,
      chapters,
    };
  }

  // 定位开始头位置
  locateStart(): number {
    const star3_reg =
      /^\*\*\* START OF THIS PROJECT GUTENBERG EBOOK .+?\*\*\*$/;

    const { lines } = this;
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (line.match(star3_reg)) {
        return index;
      }
    }

    return -1;
  }
  // 定位结尾位置
  locateEnd(): number {
    const ends = [
      /End of the Project Gutenberg EBook of/,
      /End of Project Gutenberg's/,
      /\*\*\*END OF THE PROJECT GUTENBERG EBOOK/,
      /\*\*\* END OF THIS PROJECT GUTENBERG EBOOK/,
    ];

    const { lines } = this;
    // 因为是从后往前找，所以，找到之后还需要再找10行，如果没有了才退出 index，因为有可能有多个 end，我们返回最上面的，也就是最小的一个
    let index_buffer = [] as number[];
    for (let index = lines.length - 1; index >= 0; index--) {
      const line = lines[index];
      if (
        ends.some((reg) => {
          return line.match(reg);
        })
      ) {
        index_buffer.push(index);

        const delay_try_line = index - index_buffer[0];
        if (delay_try_line > 10) {
          break;
        }
      }
    }
    if (index_buffer.length === 0) {
      return -1;
    }
    return Math.min(...index_buffer);
  }
  // 查找出所有的章节标题
  findChapters(body_start: number, body_end: number): IChapter[] {
    const headers = this.findChapterHeaders(body_start, body_end);

    // 如果章节头是空，就当作一个章节
    if (headers.length === 0) {
      return [
        {
          toc: "",
          title: "",
          content: this.getChapterContent(body_start, body_end),
        },
      ];
    }

    const chapters = headers.map((header, index) => {
      const { toc, title, line } = header;
      const next_header = headers[index + 1];
      const chapter_body_end = next_header?.line ?? body_end;
      const content = this.getChapterContent(line, chapter_body_end);
      return {
        toc,
        title,
        content,
      };
    });

    return chapters;
  }
  findChapterHeaders(body_start: number, body_end: number) {
    /**
     * 章节标题可能为
     * 第一章 第一回 第一篇 还可能为 "序" "序言"
     */
    const headers = [] as {
      toc: string;
      title: string;
      line: number;
    }[];

    const { lines } = this;
    for (let index = body_start; index < body_end; index++) {
      const line = lines[index];
      const match = line.match(/^\s*?第.{1,4}?(章|回|篇|卷)|^序|^序言|^卷.{1,2}?/);
      if (match) {
        const toc = match[0];
        const title = line.replace(toc, "").trim();
        headers.push({ toc, title, line: index });
      }
    }

    return headers;
  }
  // 解析章节标题
  getChapterContent(body_start: number, body_end: number): string {
    const chapter_lines = this.lines
      .slice(body_start + 1, body_end)
      .filter((line) => {
        // 过滤掉一些分隔符，如果一个line长度大于4，并且所有字符相同，则过滤掉
        const is_gap_line =
          line.length > 5 && line.split("").every((char) => char === line[0]);
        return is_gap_line == false;
      });
    if (chapter_lines.length === 0) {
      return "";
    }
    // 弹出开头的空白段
    while (chapter_lines[0].trim() === "") {
      chapter_lines.shift();
      if (chapter_lines.length === 0) {
        return "";
      }
    }
    // 弹出结尾的空白段
    while (chapter_lines[chapter_lines.length - 1].trim() === "") {
      chapter_lines.pop();
      if (chapter_lines.length === 0) {
        return "";
      }
    }
    // 如果第一行是 "Produced by " 去掉
    if (chapter_lines[0].trim().startsWith("Produced by ")) {
      chapter_lines.shift();
    }
    if (chapter_lines.length === 0) {
      return "";
    }
    return this.mergeChapterLines(chapter_lines).join("\n");
  }
  /**
   * 合并章节文本，需要处理错误的段落分割
   *
   * 恢复规则：首先找出错误切割的文本最大长度，这个最大长度应该是个普遍值，大部分文本均为这个长度。然后，根据这个长度判断文本是否被截断，如果属于截断文本，并且下一段开头不是空白字符，那么就合并为同一段。
   */
  mergeChapterLines(lines: string[]) {
    /**
     * 找到常见的段落长度（出现频率最高的长度）
     * @param lengths 每一行的长度数组
     */
    function findCommonLength(lengths: number[]): number {
      const frequencyMap = new Map<number, number>();

      lengths.forEach((length) => {
        frequencyMap.set(length, (frequencyMap.get(length) || 0) + 1);
      });

      let commonLength = 0;
      let maxFrequency = 0;

      frequencyMap.forEach((frequency, length) => {
        if (frequency > maxFrequency) {
          maxFrequency = frequency;
          commonLength = length;
        }
      });

      return commonLength;
    }
    // Step 1: 计算每一行的长度并找到常见的段落长度
    const lengths = lines.map((line) => line.length);
    const commonLength = findCommonLength(lengths);
    // console.log({ commonLength });

    const mergedLines: string[] = [];
    let buffer = "";

    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i];
      const isLikelyIncomplete = currentLine.length === commonLength;
      const isNextLineConnected =
        i + 1 < lines.length && !/^\s/.test(lines[i + 1]);

      if (isLikelyIncomplete && isNextLineConnected) {
        // 如果当前行长度较短且下一行非空白开头，则认为需要合并
        buffer += currentLine;
      } else {
        // 如果当前行完整或到段落结尾，将 buffer 和当前行合并并存储
        mergedLines.push(buffer + currentLine);
        buffer = "";
      }
    }

    return mergedLines;
  }
  /**
   * 在开头中可能有一些类似
   * Author: xxx
   * Release Date: xxx
   *
   * 这样的数据，解析为结构数据
   */
  parseMetadata(body_start: number): Record<string, any> {
    const { lines } = this;
    const metadata = {} as Record<string, any>;
    for (let index = 0; index < body_start; index++) {
      const line = lines[index];
      if (line.match(/^[!\S]+:/)) {
        const [key, value] = line.split(":");
        metadata[key.trim()] = value.trim();
      }
    }
    return metadata;
  }
}

async function main() {
  const fs = await import("fs");
  const path = await import("path");

  const data = fs.readFileSync("./book0.txt", "utf-8");
  // 测试
  const parser = new GutenbergBookParser(data);
  const book0 = parser.parse();
  console.log(book0.metadata);
  console.log({
    ...book0.chapters[0],
    content: "...",
  });
  fs.writeFileSync(
    path.join(process.cwd(), "book0.json"),
    JSON.stringify(book0, null, 2)
  );
  // 用html的形式输出一个用于检查段落合并是否正常
  fs.writeFileSync(
    path.join(process.cwd(), "book0.html"),
    book0.chapters
      .map((chapter) => {
        return `<h1>${chapter.toc}</h1><h2>${chapter.title}</h2>\n<section>\n${chapter.content}\n</section>`;
      })
      .join("\n")
  );
}

// main();
