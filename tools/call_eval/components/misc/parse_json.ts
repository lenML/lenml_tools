export function parse_json(text: string, fallback?: any) {
  text = text.trim();
  try {
    return JSON.parse(text);
  } catch (error) {
    // 尝试解析出 ```json...```
    if (text.startsWith("```json")) {
      const regexp = /```json\n([^`]+?)```/;
      try {
        const match = text.match(regexp);
        if (match) {
          return JSON.parse(match[1]);
        }
      } catch (error) {
        // pass
      }
    }
    // 尝试解析出 ```...```
    if (text.startsWith("```")) {
      const regexp = /```.+?\n([^`]+?)```/;
      try {
        const match = text.match(regexp);
        if (match) {
          return JSON.parse(match[1]);
        }
      } catch (error) {
        // pass
      }
    }
    // 尝试使用 json 正则
    const regexp =
      /[a-zA-Z0-9 ,.\n]+(\{[a-zA-Z0-9 \":\{\},\n]+\})[a-zA-Z0-9 ,.\n]+/;
    const match = text.match(regexp);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (error) {
        // pass
      }
    }
    if (fallback) {
      console.error(`Failed to parse json: ${text}`);
      console.error(error);
      return fallback;
    }
    throw error;
  }
}
