import { ComfyUIWorkflow, WorkflowOutput } from "@stable-canvas/comfyui-client";
import { client } from "./client";

export interface GenService<Payload = string> {
  generate(payload: Payload): Promise<{
    image: Buffer;
    result: WorkflowOutput;
  }>;
}

class BaseWorkflowService<Payload = string> implements GenService<Payload> {
  next_seed() {
    return Math.floor(Math.random() * 2 ** 32 - 1);
  }

  build_workflow(payload: Payload, wk: ComfyUIWorkflow): any {
    throw new Error("Method not implemented.");
  }

  private arrBff2Buffer(bff: ArrayBuffer): Buffer {
    const buffer = Buffer.from(bff);
    return buffer;
  }

  private async url2Buffer(url: string): Promise<Buffer> {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return this.arrBff2Buffer(buffer);
  }

  async generate(
    payload: Payload
  ): Promise<{ image: Buffer; result: WorkflowOutput }> {
    const wk = new ComfyUIWorkflow();
    this.build_workflow(payload, wk);

    const result = await wk.invoke(client);
    const { images } = result;
    const image0 = images[0];
    const image_data =
      image0.data instanceof ArrayBuffer
        ? this.arrBff2Buffer(image0.data)
        : await this.url2Buffer(image0.data);
    return {
      image: image_data,
      result: result,
    };
  }
}

export interface ModelPayload {
  steps: number;
  cfg: number;
  sampler_name: string;
  scheduler: string;
  denoise: number;
  width: number;
  height: number;
  negative: string;
  positive: string;

  clip_text?: string;
  t5_text?: string;
  flux_guidance?: number;
}

export class FluxModel extends BaseWorkflowService<ModelPayload> {
  constructor(readonly ckpt_name = "flux\\flux_dev.safetensors") {
    super();
  }

  build_workflow(payload: ModelPayload, wk: ComfyUIWorkflow) {
    const {
      CheckpointLoaderSimple,
      CLIPTextEncodeFlux,
      KSampler,
      EmptyLatentImage,
      SaveImage,
      VAEDecode,
      ETN_SendImageWebSocket,
    } = wk.classes;

    const { ckpt_name } = this;
    const {
      steps,
      cfg,
      sampler_name,
      scheduler,
      denoise,
      width,
      height,
      negative,
      positive,

      t5_text,
      clip_text,
      flux_guidance,
    } = payload;

    const [model, clip, vae] = CheckpointLoaderSimple({
      ckpt_name: ckpt_name,
    });
    const enc = (clip_str?: string, t5_str?: string) =>
      CLIPTextEncodeFlux({
        clip,
        t5xxl: t5_str ?? "",
        clip_l: clip_str ?? "",
        guidance: flux_guidance ?? 3.5,
      })[0];
    const [samples] = KSampler({
      steps,
      // NOTE: cfg 为1效果最好
      cfg: 1,
      sampler_name,
      scheduler,
      denoise,
      seed: this.next_seed(),
      model,
      positive: enc(clip_text, t5_text),
      // NOTE: flux 不支持 negative
      negative: enc(),
      latent_image: EmptyLatentImage({
        width: width,
        height: height,
        batch_size: 1,
      })[0],
    });
    // SaveImage({
    //   filename_prefix: "from-sc-comfy-ui-client",
    //   images: VAEDecode({ samples, vae })[0],
    // });
    ETN_SendImageWebSocket({
      images: VAEDecode({ samples, vae })[0],
    });
  }
}

export class SDXLModel extends BaseWorkflowService<ModelPayload> {
  constructor(
    readonly ckpt_name = "sdxl\\ponyDiffusionV6XL_v6StartWithThisOne.safetensors"
  ) {
    super();
  }

  build_workflow(payload: ModelPayload, wk: ComfyUIWorkflow) {
    const {
      CheckpointLoaderSimple,
      CLIPTextEncode,
      KSampler,
      EmptyLatentImage,
      SaveImage,
      VAEDecode,
      ETN_SendImageWebSocket,
      Efficient_Loader,
    } = wk.classes;
    const { ckpt_name } = this;
    let {
      steps,
      cfg,
      sampler_name,
      scheduler,
      denoise,
      width,
      height,
      negative,
      positive,
    } = payload;

    if (!negative.includes("DeepNegative_xl_v1")) {
      negative += ", embedding:DeepNegative_xl_v1";
    }

    const [model, positive_cond, negative_cond, latent, vae, clip, deps] =
      wk.node("Efficient Loader", {
        ckpt_name: ckpt_name,
        vae_name: "Baked VAE",
        clip_skip: -2,
        positive: positive,
        negative: negative,
        token_normalization: "none",
        weight_interpretation: "A1111",
        empty_latent_height: height,
        empty_latent_width: width,
        batch_size: 1,
        lora_name:
          "xl\\Concept Art Twilight Style SDXL_LoRA_Pony Diffusion V6 XL.safetensors",
        lora_model_strength: 0.8,
        lora_clip_strength: 1,
      });

    const [samples] = KSampler({
      steps,
      cfg,
      sampler_name,
      scheduler,
      denoise,
      seed: this.next_seed(),
      model,
      positive: positive_cond,
      negative: negative_cond,
      latent_image: latent,
    });
    // SaveImage({
    //   filename_prefix: "from-sc-comfy-ui-client",
    //   images: VAEDecode({ samples, vae })[0],
    // });
    ETN_SendImageWebSocket({
      images: VAEDecode({ samples, vae })[0],
    });
  }
}

export class SD15Model extends BaseWorkflowService<ModelPayload> {
  constructor(readonly ckpt_name = "LOFI_V5.fp16.safetensors") {
    super();
  }

  build_workflow(payload: ModelPayload, wk: ComfyUIWorkflow) {
    const {
      CheckpointLoaderSimple,
      CLIPTextEncode,
      KSampler,
      EmptyLatentImage,
      SaveImage,
      VAEDecode,
      ETN_SendImageWebSocket,
    } = wk.classes;
    const { ckpt_name } = this;
    const {
      steps,
      cfg,
      sampler_name,
      scheduler,
      denoise,
      width,
      height,
      negative,
      positive,
    } = payload;

    const [model, clip, vae] = CheckpointLoaderSimple({
      ckpt_name: ckpt_name,
    });
    const enc = (text: string) => CLIPTextEncode({ text, clip })[0];
    const [samples] = KSampler({
      steps,
      cfg,
      sampler_name,
      scheduler,
      denoise,
      seed: this.next_seed(),
      model,
      positive: enc(positive),
      negative: enc(negative),
      latent_image: EmptyLatentImage({
        width: width,
        height: height,
        batch_size: 1,
      })[0],
    });
    // SaveImage({
    //   filename_prefix: "from-sc-comfy-ui-client",
    //   images: VAEDecode({ samples, vae })[0],
    // });
    ETN_SendImageWebSocket({
      images: VAEDecode({ samples, vae })[0],
    });
  }
}
