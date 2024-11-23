import { BaseEvaluator } from "../evaluator";
import fs from "fs";
import path from "path";
import { BaseJudger } from "../judger";

const system_prompt = fs.readFileSync(
  path.resolve(__dirname, "./creative_self.prompt.txt"),
  "utf-8"
);

const jsonschema = {
  type: "object",
  properties: {
    creativity: {
      type: "object",
      properties: {
        analysis: {
          type: "string",
        },
        score: {
          type: "integer",
          minimum: 0,
          maximum: 25,
        },
      },
      required: ["score", "analysis"],
      additionalProperties: false,
    },
    coherence: {
      type: "object",
      properties: {
        analysis: {
          type: "string",
        },
        score: {
          type: "integer",
          minimum: 0,
          maximum: 25,
        },
      },
      required: ["score", "analysis"],
      additionalProperties: false,
    },
    emotional_depth: {
      type: "object",
      properties: {
        analysis: {
          type: "string",
        },
        score: {
          type: "integer",
          minimum: 0,
          maximum: 20,
        },
      },
      required: ["score", "analysis"],
      additionalProperties: false,
    },
    character_development: {
      type: "object",
      properties: {
        analysis: {
          type: "string",
        },
        score: {
          type: "integer",
          minimum: 0,
          maximum: 15,
        },
      },
      required: ["score", "analysis"],
      additionalProperties: false,
    },
    theme_relevance: {
      type: "object",
      properties: {
        analysis: {
          type: "string",
        },
        score: {
          type: "integer",
          minimum: 0,
          maximum: 15,
        },
      },
      required: ["score", "analysis"],
      additionalProperties: false,
    },
  },
  required: [
    "creativity",
    "coherence",
    "emotional_depth",
    "character_development",
    "theme_relevance",
  ],
  additionalProperties: false,
};

export class CreativeSelfJudger extends BaseJudger<
  string,
  {
    creativity: number;
    coherence: number;
    emotional_depth: number;
    character_development: number;
    theme_relevance: number;
    total_score: number;
  }
> {
  SYSTEM_PROMPT = system_prompt;

  request_prompt_template(instruction: string, response: string) {
    return `
# Instruction
\`\`\`
${instruction}
\`\`\`

# Writer's response
\`\`\`
${response}
\`\`\`

now, please give me some creative, coherence, emotional depth, character development, and theme relevance score.
    `.trim();
  }

  parse_json(text: string) {
    try {
      return JSON.parse(text);
    } catch (error) {
      // 尝试解析出 ```json...```
      if (text.startsWith("```json") && text.endsWith("```")) {
        return JSON.parse(text.slice(6, text.length - 3));
      }
      // 尝试解析出 ```...```
      if (text.startsWith("```") && text.endsWith("```")) {
        return JSON.parse(text.slice(3, text.length - 3));
      }
      throw error;
    }
  }

  async judge(
    prompt: string,
    response: string
  ): Promise<{
    creativity: number;
    coherence: number;
    emotional_depth: number;
    character_development: number;
    theme_relevance: number;
    total_score: number;
  }> {
    const request_prompt = this.request_prompt_template(prompt, response);
    const resp = await this.model.chat_completion({
      prompt: request_prompt,
      system_prompt: this.SYSTEM_PROMPT,
      jsonschema,
      config: {
        max_tokens: 8192,
        temperature: 0.3,
      },
    });
    const json = this.parse_json(resp);
    return {
      creativity: json.creativity.score,
      coherence: json.coherence.score,
      emotional_depth: json.emotional_depth.score,
      character_development: json.character_development.score,
      theme_relevance: json.theme_relevance.score,
      total_score:
        json.creativity.score +
        json.coherence.score +
        json.emotional_depth.score +
        json.character_development.score +
        json.theme_relevance.score,
    };
  }
}
