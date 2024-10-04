import random
import torch
import torch.nn as nn
from torch.autograd import Variable
from torchvision import models
import numpy as np
import matplotlib.pyplot as plt
from PIL import Image
import os
import tqdm
import scipy.ndimage as nd
from torchvision import transforms
from typing import List, Union, Optional

# 全局变量：图像预处理和后处理所需的均值和标准差
mean = np.array([0.485, 0.456, 0.406])
std = np.array([0.229, 0.224, 0.225])

# 预处理变换
preprocess = transforms.Compose(
    [transforms.ToTensor(), transforms.Normalize(mean, std)]
)


def deprocess(image_np: np.ndarray) -> np.ndarray:
    """将神经网络输出的图像张量转换回正常图像"""
    image_np = image_np.squeeze().transpose(1, 2, 0)
    image_np = image_np * std.reshape((1, 1, 3)) + mean.reshape((1, 1, 3))
    image_np = np.clip(image_np, 0.0, 1.0)
    return image_np


def clip(image_tensor: torch.Tensor) -> torch.Tensor:
    """裁剪图像张量，确保值在有效范围内"""
    for c in range(3):
        m, s = mean[c], std[c]
        image_tensor[0, c] = torch.clamp(image_tensor[0, c], -m / s, (1 - m) / s)
    return image_tensor


class ModelLoader:
    def __init__(self, model_name: str, at_layer: int):
        self.model_name = model_name
        self.at_layer = at_layer
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = self.load_model()

    def load_model(self) -> nn.Sequential:
        """加载预训练模型，默认使用vgg19"""
        network = getattr(models, self.model_name, lambda: None)(pretrained=True)
        if network is None:
            raise ValueError(f"Network not found: {self.model_name}")

        layers = list(network.features.children())
        model = nn.Sequential(*layers[: (self.at_layer + 1)])
        model = model.to(self.device)
        print(f"[loaded] all {len(layers)} layers, using layer {self.at_layer}")
        return model


class DeepDreamProcessor:
    def __init__(
        self,
        model: nn.Module,
        iterations: int,
        lr: float,
        octave_scale: float,
        num_octaves: int,
    ):
        self.model = model
        self.iterations = iterations
        self.lr = lr
        self.octave_scale = octave_scale
        self.num_octaves = num_octaves

    def dream(self, image: torch.Tensor) -> np.ndarray:
        """更新图片，优化若干次以最大化模型输出"""
        Tensor = (
            torch.cuda.FloatTensor if torch.cuda.is_available() else torch.FloatTensor
        )
        image = Variable(Tensor(image), requires_grad=True)

        for _ in range(self.iterations):
            self.model.zero_grad()
            out = self.model(image)
            loss = out.norm()
            loss.backward()
            avg_grad = np.abs(image.grad.data.cpu().numpy()).mean()
            norm_lr = self.lr / avg_grad
            image.data += norm_lr * image.grad.data
            image.data = clip(image.data)
            image.grad.data.zero_()

        return image.cpu().data.numpy()

    def process(self, image: Image.Image) -> np.ndarray:
        """主DeepDream算法"""
        image = preprocess(image).unsqueeze(0).cpu().data.numpy()

        # 多个octave的图像表示
        octaves = [image]
        for _ in range(self.num_octaves - 1):
            octaves.append(
                nd.zoom(
                    octaves[-1],
                    (1, 1, 1 / self.octave_scale, 1 / self.octave_scale),
                    order=1,
                )
            )

        detail = np.zeros_like(octaves[-1])
        for octave, octave_base in enumerate(tqdm.tqdm(octaves[::-1], desc="Dreaming")):
            if octave > 0:
                detail = nd.zoom(
                    detail,
                    np.array(octave_base.shape) / np.array(detail.shape),
                    order=1,
                )

            input_image = octave_base + detail
            try:
                dreamed_image = self.dream(input_image)
                detail = dreamed_image - octave_base
            except RuntimeError as e:
                import traceback

                msg = traceback.format_exc()
                print(msg)
                print(f"[octave error] octave: {octave}, skipping...")
                continue

        return deprocess(dreamed_image)


class ImageHandler:
    def __init__(
        self,
        input_dir: str,
        output_dir: str,
        prefix: bool,
        model_name: str,
        at_layer: int,
        processor: DeepDreamProcessor,
    ):
        self.input_dir = input_dir
        self.output_dir = output_dir
        self.prefix = prefix
        self.model_name = model_name
        self.at_layer = at_layer
        self.processor = processor

    def is_image_filepath(self, filepath: str) -> bool:
        """检查文件是否为有效的图片格式"""
        return filepath.lower().endswith(
            (
                ".bmp",
                ".dib",
                ".png",
                ".jpg",
                ".jpeg",
                ".pbm",
                ".pgm",
                ".ppm",
                ".tif",
                ".tiff",
            )
        )

    def dream_image(
        self,
        image_path: str,
        plt_show: bool = False,
    ) -> None:
        """处理单张图像"""
        image = Image.open(image_path)
        filename = os.path.basename(image_path)
        if self.prefix:
            filename = f"{self.model_name}_{filename}"
        output_image_path = os.path.join(self.output_dir, filename)

        if os.path.exists(output_image_path):
            print(f"[skip] output already exists: {output_image_path}")
            return

        dreamed_image = self.processor.process(image)

        # 保存结果
        plt.imsave(output_image_path, dreamed_image)
        print(f"[saved] file saved to {output_image_path}")

        if plt_show:
            plt.figure(figsize=(20, 20))
            plt.imshow(dreamed_image)
            plt.show()

    def process_directory(self) -> None:
        """处理目录中的所有图片"""
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir, exist_ok=True)

        files = os.listdir(self.input_dir)
        print(f"dreaming for {self.input_dir}, {len(files)} images")

        for fp in files:
            if not self.is_image_filepath(fp):
                print(f"[skip] not an image file: {fp}")
                continue

            path = os.path.join(self.input_dir, fp)
            print(f"[processing] {path}")
            try:
                self.dream_image(path)
            except Exception as e:
                print(f"[error] {e}, skipping {path}")
