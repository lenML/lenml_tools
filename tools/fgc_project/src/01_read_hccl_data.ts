/**
 * 这个脚本读取 ./data 下面的文件夹
 * 下面有类似 ./data/西游记 这样的文件夹，其中每个 txt 文件为一章节
 * 文件名类似 `001 第一回 靈根育孕源流出 心性修持大道生.txt` 其中 001 为 index,后面的为标题
 * 这样的文件夹结构
 *
 * 下面的脚本用于解析这样的数据，并储存为一个 json 对象
 * 注意有多个文件夹需要读取，都是类似的格式 `./data/三国演义` `./data/红楼梦`
 */
import fs from "fs";
import path from "path";
import Chinese from "chinese-s2t";

/**
 * 读取章节文件的内容
 * @param {string} filePath - 文件路径
 * @returns {string} 章节内容
 */
const parseChapterFile = (filePath: string): string => {
  const content = fs.readFileSync(filePath, "utf-8");
  return content;
};

/**
 * 解析文件夹中的所有章节
 * @param {string} folderPath - 文件夹路径
 * @returns {object} 解析后的书籍章节信息
 */
const parseFolder = (
  folderPath: string
): {
  title: string;
  chapters: { index: number; title: string; content: string }[];
} => {
  const folderName = path.basename(folderPath);
  const files = fs.readdirSync(folderPath);

  // 过滤出 .txt 文件并根据文件名排序
  const chapterFiles = files
    .filter((file) => file.endsWith(".txt"))
    .sort((a, b) => {
      const aIndex = parseInt(a.split(" ")[0], 10);
      const bIndex = parseInt(b.split(" ")[0], 10);
      return aIndex - bIndex;
    });

  const chapters = chapterFiles.map((file) => {
    const chapterIndex = parseInt(file.split(" ")[0], 10);
    const chapterTitle = file.split(" ").slice(1).join(" ").replace(".txt", "");
    const chapterContent = parseChapterFile(path.join(folderPath, file));

    return {
      index: chapterIndex,
      title: chapterTitle,
      content: chapterContent,
    };
  });

  return {
    title: folderName,
    chapters,
  };
};

/**
 * 解析 ./data 目录下的所有书籍文件夹
 * @returns {object[]} 解析后的所有书籍信息
 */
const parseDataDir = (): {
  title: string;
  chapters: { index: number; title: string; content: string }[];
}[] => {
  const folders = fs
    .readdirSync(dataDir)
    .filter((file) => fs.statSync(path.join(dataDir, file)).isDirectory());

  const books = folders.map((folder) => {
    const folderPath = path.join(dataDir, folder);
    return parseFolder(folderPath);
  });

  return books;
};

/**
 * 清理文本
 */
function clean_text(text: string) {
  text = text.trim();
  text = Chinese.t2s(text);
  return text;
}

// 数据存放路径
const dataDir = "./hccl_data";
// const dataDir = "./data";

// 执行并输出结果
const books = parseDataDir();

(async () => {
  // 清理所有文本和标题
  for (const book of books) {
    book.title = await clean_text(book.title);
    for (const chapter of book.chapters) {
      chapter.content = await clean_text(chapter.content);
      chapter.title = await clean_text(chapter.title);
      // 如果第一行就是标题，则删除
      const line0 = chapter.content.split("\n")[0];
      const is_title0 = line0 === chapter.title;
      // 移除所有标点符号之后
      const like_title0 =
        line0.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/, "") ===
        chapter.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/, "");
      if (is_title0 || like_title0) {
        chapter.content = chapter.content.split("\n").slice(1).join("\n");
      }
    }
  }
  // console.log(JSON.stringify(books, null, 2));
  fs.writeFileSync("books.json", JSON.stringify(books, null, 2));
  console.log(`${books.length} books written to books.json`);

  // 改为segment格式
  let index = 0;
  const segments = books.flatMap((book) => {
    return book.chapters.map((chapter) => {
      index += 1;
      return {
        index: index,
        book: book.title,
        chapter: chapter.title,
        content: chapter.content,
      };
    });
  });
  fs.writeFileSync("segments.json", JSON.stringify(segments, null, 2));
  console.log(`${segments.length} segments written to segments.json`);
})();
