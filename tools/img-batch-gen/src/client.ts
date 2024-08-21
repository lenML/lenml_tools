import { ComfyUIApiClient } from "@stable-canvas/comfyui-client";
import WebSocket from "ws";

export const client = new ComfyUIApiClient({
  api_host: process.env.API_HOST || "127.0.0.1:8188",
  clientId: "lenml_tools",
  WebSocket: WebSocket as any,
});

process.nextTick(() => {
  client.connect();
});
