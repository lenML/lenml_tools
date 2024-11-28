process.env["NO_PROXY"] = "localhost,127.0.0.1,0.0.0.0";

import _fetch from "node-fetch-with-proxy";
import fs from "fs";
import path from "path";
import { RequestLimiter } from "./RequestLimiter";

const resp_sample0 = {
  id: "chatcmpl-i3j8ovy7xwd2a6d5rhkcx1",
  object: "chat.completion",
  created: 1732720421,
  model: "c4ai-command-r-08-2024",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: "测试成功。",
      },
      logprobs: null,
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 22,
    completion_tokens: 3,
    total_tokens: 25,
  },
  system_fingerprint: "c4ai-command-r-08-2024",
};
type ResponseData = typeof resp_sample0;

interface IModelConfig {
  model: string;

  BASE_URL: string;
  API_KEY?: string;

  support_schema?: boolean;

  // 请求频率限制
  request_limit?: {
    rps?: number; // requests per second
    rpm?: number; // requests per minute
    rph?: number; // requests per hour
    rpd?: number; // requests per day
  };
}

type ModelParams = {
  temperature?: number;
  max_tokens?: number;
  top_k?: number;
  top_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stop?: string[];
};

export class Model {
  static createFromFile(filepath: string) {
    const config = JSON.parse(fs.readFileSync(filepath, "utf-8"));

    // BASE_URL 和 API_KEY 可以来自 env
    if (typeof config.BASE_URL === "object") {
      const { from_env } = config.BASE_URL;

      if (from_env && process.env[from_env]) {
        config.BASE_URL = process.env[from_env];
      } else {
        throw new Error("Cannot find BASE_URL from env");
      }
    }
    if (typeof config.API_KEY === "object") {
      const { from_env } = config.API_KEY;

      if (from_env && process.env[from_env]) {
        config.API_KEY = process.env[from_env];
      } else {
        throw new Error("Cannot find API_KEY from env");
      }
    }

    return new Model(config);
  }

  config: IModelConfig;

  limiter?: RequestLimiter;

  constructor(config: Partial<IModelConfig> = {}) {
    this.config = {
      model: "chatgpt-3.5",
      BASE_URL: "https://api.openai.com",
      ...config,
      support_schema: config.support_schema ?? true,
    };
    if (config.request_limit) {
      this.limiter = new RequestLimiter(config.request_limit);
    }
  }

  fetch: typeof globalThis.fetch = _fetch;

  get BASE_URL() {
    return this.config.BASE_URL;
  }
  get API_KEY() {
    return this.config.API_KEY;
  }

  async completion(params: {
    prompt: string;
    max_tokens?: number;
    params?: ModelParams;
  }): Promise<string> {
    await this.limiter?.start();
    try {
      return await this._completion(params);
    } finally {
      await this.limiter?.end();
    }
  }

  private async _completion({
    prompt,
    max_tokens = 6,
    params,
  }: {
    prompt: string;
    max_tokens?: number;
    params?: ModelParams;
  }): Promise<string> {
    const { BASE_URL } = this;
    const resp = await this.fetch(`${BASE_URL}/v1/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.API_KEY ? `Bearer ${this.API_KEY}` : "sk-xxx",
      },
      body: JSON.stringify({
        model: this.config.model,
        ...params,
        max_tokens,
        prompt,
      }),
    });
    const json = await resp.json();
    if (json.error) throw new Error(json.error);
    return json.choices[0].text;
  }

  async chat_completion(params: {
    prompt: string;
    system_prompt?: string;
    jsonschema?: any;
    history?: {
      role: "user" | "assistant";
      content: string;
    }[];
    config?: ModelParams;
    callback?: (text: string, data: ResponseData, resp: Response) => void;
  }): Promise<string> {
    await this.limiter?.start();
    try {
      return await this._chat_completion(params);
    } finally {
      await this.limiter?.end();
    }
  }

  private async _chat_completion({
    prompt,
    system_prompt = "",
    jsonschema = null,
    history,
    config = {
      max_tokens: 64,
    },
    callback,
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
    callback?: (text: string, data: ResponseData, resp: Response) => void;
  }): Promise<string> {
    const { BASE_URL } = this;
    const resp = await this.fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.API_KEY ? `Bearer ${this.API_KEY}` : "sk-xxx",
      },
      body: JSON.stringify({
        model: this.config.model,
        ...config,
        messages: [
          system_prompt ? { role: "system", content: system_prompt } : null,
          ...(history || []),
          { role: "user", content: prompt },
        ].filter(Boolean),
        ...(jsonschema && this.config.support_schema
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
    const text = json.choices[0].message.content;
    callback?.(text, json, resp);
    return text;
  }
}
