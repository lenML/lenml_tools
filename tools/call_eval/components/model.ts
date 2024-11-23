interface IModelConfig {
  model: string;
  temperature: number;
  top_k: number;
  BASE_URL: string;
}

export class Model {
  config: IModelConfig;

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
    config = {
      max_tokens: 64,
    },
  }: {
    prompt: string;
    system_prompt?: string;
    jsonschema?: any;
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...this.config,
        ...config,
        messages: [
          system_prompt ? { role: "system", content: system_prompt } : null,
          { role: "user", content: prompt },
        ].filter(Boolean),
        ...(jsonschema
          ? {
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "creative_story",
                  schema: jsonschema,
                },
              },
            }
          : {}),
      }),
    });
    const json = await resp.json();
    if (json.error) throw new Error(json.error);
    return json.choices[0].message.content;
  }
}
