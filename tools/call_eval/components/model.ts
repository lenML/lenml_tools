process.env["NO_PROXY"] = "localhost,127.0.0.1,0.0.0.0";

import fetch from "node-fetch-with-proxy";

interface IModelConfig {
  model: string;
  temperature: number;
  top_k: number;

  BASE_URL: string;
  API_KEY?: string;
}

export class Model {
  config: IModelConfig;

  support_schema = true;

  constructor(config: Partial<IModelConfig> = {}) {
    this.config = {
      model: "chatgpt-3.5",
      temperature: 1,
      top_k: 40,
      BASE_URL: "https://api.openai.com",
      ...config,
    };
  }

  get BASE_URL() {
    return this.config.BASE_URL;
  }
  get API_KEY() {
    return this.config.API_KEY;
  }

  async completion({
    prompt,
    max_tokens = 6,
  }: {
    prompt: string;
    max_tokens?: number;
  }): Promise<string> {
    const { BASE_URL } = this;
    const resp = await fetch(`${BASE_URL}/v1/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...this.config,
        max_tokens,
        prompt,
      }),
    });
    const json = await resp.json();
    if (json.error) throw new Error(json.error);
    return json.choices[0].text;
  }

  async chat_completion({
    prompt,
    system_prompt = "",
    jsonschema = null,
    history,
    config = {
      max_tokens: 64,
    },
  }: {
    prompt: string;
    system_prompt?: string;
    jsonschema?: any;
    history?: {
      role: "user" | "assistant";
      content: string;
    }[];
    config?: {
      temperature?: number;
      max_tokens?: number;
      top_k?: number;
      top_p?: number;
      presence_penalty?: number;
      frequency_penalty?: number;
      stop?: string[];
    };
  }): Promise<string> {
    const { BASE_URL } = this;
    const resp = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Authorization: this.API_KEY ? `Bearer ${this.API_KEY}` : "sk-xxx",
      },
      body: JSON.stringify({
        ...this.config,
        ...config,
        BASE_URL: undefined,
        API_KEY: undefined,
        messages: [
          system_prompt ? { role: "system", content: system_prompt } : null,
          ...(history || []),
          { role: "user", content: prompt },
        ].filter(Boolean),
        ...(jsonschema && this.support_schema
          ? {
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "response_format",
                  strict: true,
                  schema: jsonschema,
                },
              },
            }
          : {}),
      }),
    });
    if (resp.status !== 200) {
      const content = await resp.text();
      throw new Error(`${resp.status} ${resp.statusText}: ${content}`);
    }
    const content = await resp.text();
    if (!content.trim()) {
      throw new Error("no content");
    }
    const json = JSON.parse(content);
    if (json.error) {
      throw new Error(
        typeof json.error === "string" ? json.error : JSON.stringify(json.error)
      );
    }
    return json.choices[0].message.content;
  }
}
