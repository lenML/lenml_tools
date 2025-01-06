// import data from "./datasets/lb-anime.json";
import fs from "fs";
import path from "path";

const data = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "datasets", "len_acg01.json"))
);

/**
 *
 * @param {string} str
 * @returns {string}
 */
function decodeHtmlEntities(str) {
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 *
 * @param {string} text
 */
const parseOptions = (text) => {
  const options = [];

  let index = 0;
  const eof = () => index >= text.length;
  const consume = () => text[index++];
  const peek = () => text[index];
  while (!eof()) {
    const char = consume();
    if ("abcd".includes(char.toLowerCase())) {
      parse_one_option(char);
      continue;
    } else if (char === " " || char === "\n") {
      continue;
    }
  }

  return options.map(decodeURIComponent).map(decodeHtmlEntities);

  /**
   *
   * @param {string} option
   */
  function parse_one_option(option) {
    let buffer = "";
    while (!eof()) {
      const char = consume();
      if (char === "、") {
        continue;
      }
      if ("abcd".includes(char.toLowerCase()) && peek() === "、") {
        options.push(buffer.trim());
        parse_one_option(char);
        return;
      }
      buffer += char;
    }
    options.push(buffer.trim());
  }
};

const next_data = data.map((x, idx) => {
  const options = parseOptions(x.options);
  return {
    index: idx,
    question: x.question.replace(/^\d+、/g, "").trim(),
    options,
    answer: options[0],
  };
});

fs.writeFileSync(
  path.join(process.cwd(), "out.json"),
  JSON.stringify(next_data, null, 2)
);
