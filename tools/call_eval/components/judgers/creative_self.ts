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
    judged: any;
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

  async judge(
    prompt: string,
    response: string
  ): Promise<{
    judged: any;
    total_score: number;
  }> {
    try {
      return await this._judge(prompt, response);
    } catch (error) {
      console.error(error);
      return {
        judged: { error: error?.message ?? String(error) },
        total_score: 0,
      };
    }
  }

  private async _judge(
    prompt: string,
    response: string
  ): Promise<{
    judged: any;
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
    const json = this.parse_json(resp, {
      creativity: {
        score: 0,
        analysis: "",
      },
      coherence: {
        score: 0,
        analysis: "",
      },
      emotional_depth: {
        score: 0,
        analysis: "",
      },
      character_development: {
        score: 0,
        analysis: "",
      },
      theme_relevance: {
        score: 0,
        analysis: "",
      },
      total_score: 0,
    });
    return {
      judged: json,
      total_score:
        json.creativity.score +
        json.coherence.score +
        json.emotional_depth.score +
        json.character_development.score +
        json.theme_relevance.score,
    };
  }
}
