import fs from "fs";
import path from "path";
import Chinese from "chinese-s2t";
import {
  GutenbergBookParser,
  IBookParseResult,
} from "./02_parse_gutenberg_book";

interface Book {
  id: string;
  text: string;
}

function readData(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  const books = JSON.parse(content) as {
    id: string;
    text: string;
  }[];
  return books;
}

const books = readData(
  path.join(process.cwd(), "zh-00000-of-00001-bca42330c6f1826c.json")
);

console.log(`Books: ${books.length}`);

const books_data = books
  .map((book, index) => {
    const parser = new GutenbergBookParser(book.text);
    const book_data = parser.parse();
    console.log(
      `[${(index + 1).toString().padStart(3, "0")}/${books.length}] parse ${
        book.id
      }, ${book_data.chapters.length} chapters`
    );
    return {
      ...book_data,
      id: book.id,
    };
  })
  .filter((x) => {
    // 跳过 Language: English 的书
    return x.metadata.Language !== "English";
  })
  .filter((x) => {
    // 过滤掉没有解析出章节的，我们把章节==1表示没有解析出章节
    return x.chapters.length > 1;
  });

fs.writeFileSync(
  path.join(process.cwd(), "zh-00000-of-00001-bca42330c6f1826c_clean.json"),
  JSON.stringify(books_data, null, 2)
);

const book_to_html = (book: IBookParseResult) => {
  const book_data = Object.entries(book.metadata).map(([key, value]) => {
    return `<p><label>${key}</label><span>${value}</span></p>`;
  });
  const chapters = book.chapters
    .map((chapter) => {
      return `<h1>${chapter.toc}</h1><h2>${chapter.title}</h2>\n<section>\n${chapter.content}\n</section>`;
    })
    .join("\n");
  return `<article>\n${book_data.join("")}\n${chapters}\n</article>`;
};

// 在把每个书都写为 html 格式，写入到 ./books_data 文件夹中

for (const book of books_data) {
  fs.writeFileSync(
    path.join(process.cwd(), "books_data", `${book.id}.html`),
    book_to_html(book)
  );
}
