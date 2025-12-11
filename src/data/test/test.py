import re
import json

 
def parse_gpu_topology(text)-> tuple:
    lines = text.strip().split('\n')
    # 1. 提取表头 (Header)
    # 替换其中的空格以方便分割，例如 "CPU Affinity" -> "CPU_Affinity"
    header_line = lines[0].replace("CPU Affinity", "CPU_Affinity").replace("NUMA Affinity", "NUMA_Affinity")
    headers = header_line.split()
    
    matrix_data = []
    legend_data = {}
    
    parsing_legend = False
    
    for line in lines[1:]:
        line = line.strip()
        if not line:
            continue
            
        # 检测是否到了 Legend 部分
        if line.startswith("Legend:"):
            parsing_legend = True
            continue
            
        if parsing_legend:
            # 解析图例，例如 "X = Self"
            if "=" in line:
                key, desc = line.split("=", 1)
                legend_data[key.strip()] = desc.strip()
        else:
            # 解析矩阵数据行
            parts = line.split()
            
            # 第一列是设备名称 (Row Device)
            row_device = parts[0]
            row_info = {"device": row_device}
            
            # 这里的逻辑是：每一行包含 [设备名, 矩阵值1, 矩阵值2..., CPU亲和性, NUMA亲和性]
            # 注意：有些行可能没有 CPU/NUMA Affinity (例如 mlx5_1 在原文本中似乎只有SYS结尾，但看起来只是缺失数据)
            # 我们根据 headers 的长度来映射
            
            # 矩阵连接信息 (对应 Header 中的设备列)
            # headers 中的前 N 个元素是设备列名
            # parts 中的第 1 到 N 个元素是连接状态
            
            # 找出属于矩阵连接的列数 (去掉最后的 Affinity 列)
            matrix_cols_count = 0
            for h in headers:
                if "Affinity" not in h:
                    matrix_cols_count += 1
            
            connections = {}
            for i in range(matrix_cols_count):
                if i + 1 < len(parts):
                    target_device = headers[i]
                    connections[target_device] = parts[i+1]
            
            row_info["connections"] = connections
            
            # 提取 Affinity 信息 (如果存在)
            # 倒数第二列通常是 CPU Affinity，最后一列是 NUMA
            # 但要注意 mlx 网卡行可能数据不全，需要动态判断
            if len(parts) > matrix_cols_count + 1:
                 # 假设最后两列固定是 Affinity
                 row_info["cpu_affinity"] = parts[-2]
                 row_info["numa_affinity"] = parts[-1]
            
            matrix_data.append(row_info)

    return matrix_data, legend_data

file = "./摩尔.txt"
# 从file中读取内容
with open(file, "r", encoding="utf-8") as f:
    raw_text = f.read()

# 执行解析
topology_data, legend = parse_gpu_topology(raw_text)

# 保存为 JSON 文件
output_file = "gpu_topology.json"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(topology_data, f, ensure_ascii=False, indent=2)

# 保存Legend为单独的JSON文件
legend_file = "legend.json"
with open(legend_file, "w", encoding="utf-8") as f:
    json.dump(legend, f, ensure_ascii=False, indent=2)

# 打印结果 (JSON 格式化输出)
print("--- 解析后的拓扑数据 (JSON格式) ---")
print(json.dumps(topology_data[0:2], indent=2)) # 仅展示前两项作为示例
print("\n(...... 数据省略 ......)\n")

print("--- 解析后的图例说明 ---")
print(json.dumps(legend, indent=2))

# 简单的数据访问示例
print("\n--- 简单查询示例 ---")
print(f"GPU0 和 GPU1 的连接关系是: {topology_data[0]['connections']['GPU1']}")
print(f"GPU0 的 CPU Affinity 是: {topology_data[0].get('cpu_affinity')}")