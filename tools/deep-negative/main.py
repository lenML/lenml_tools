from DeepDream import DeepDreamProcessor, ImageHandler, ModelLoader


if __name__ == "__main__":
    # 配置参数
    input_dir = "./inputs"
    output_dir = "./outputs"
    prefix = False
    model_name = "vgg19"
    at_layer = 27
    iterations = 20
    lr = 0.01
    octave_scale = 1.4
    num_octaves = 10

    # 模型加载和处理器初始化
    model_loader = ModelLoader(model_name, at_layer)
    processor = DeepDreamProcessor(
        model_loader.model, iterations, lr, octave_scale, num_octaves
    )

    # 创建图像处理器并处理目录
    handler = ImageHandler(
        input_dir, output_dir, prefix, model_name, at_layer, processor
    )
    handler.process_directory()
