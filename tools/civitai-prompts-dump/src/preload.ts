import "esm-hook";
import fetch, { Headers } from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";

const httpsProxy = process.env.https_proxy;
const httpsAgent = httpsProxy ? new HttpsProxyAgent(httpsProxy) : null;

const fetchWithProxy = (input: RequestInfo, init?: RequestInit) =>
  fetch(
    input as any,
    {
      ...init,
      agent: httpsAgent,
    } as any
  );

if (httpsProxy) {
  console.log(`[proxy] ${httpsProxy}`);
}

// @ts-ignore
globalThis.fetch = fetchWithProxy;
// @ts-ignore
globalThis.Headers = Headers;
