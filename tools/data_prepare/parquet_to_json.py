import pyarrow.parquet as pq
import json
import os


def parquet_to_json(input_parquet_path, output_json_path):
    """
    将 Parquet 文件转换为 JSON 文件

    参数:
    input_parquet_path (str): 输入 Parquet 文件路径
    output_json_path (str): 输出 JSON 文件路径
    """
    try:
        table = pq.read_table(input_parquet_path)
        df = table.to_pandas()

        json_data = df.to_dict(orient="records")

        with open(output_json_path, "w", encoding="utf-8") as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)

        print(f"成功将 {input_parquet_path} 转换为 {output_json_path}")

    except Exception as e:
        print(f"转换过程中发生错误: {e}")


def batch_convert_parquet_to_json(input_dir, output_dir):
    """
    批量转换目录中的 Parquet 文件为 JSON 文件

    参数:
    input_dir (str): 输入 Parquet 文件目录
    output_dir (str): 输出 JSON 文件目录
    """
    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)

    # 遍历输入目录中的所有文件
    for filename in os.listdir(input_dir):
        if filename.endswith(".parquet"):
            input_path = os.path.join(input_dir, filename)
            output_filename = filename.replace(".parquet", ".json")
            output_path = os.path.join(output_dir, output_filename)

            # 转换单个文件
            parquet_to_json(input_path, output_path)


def main():
    # 单文件转换示例
    # parquet_to_json('input.parquet', 'output.json')

    # 批量转换示例
    input_directory = "./parquet_files"  # 包含 Parquet 文件的输入目录
    output_directory = "./json_files"  # 输出 JSON 文件的目录
    batch_convert_parquet_to_json(input_directory, output_directory)


if __name__ == "__main__":
    main()
