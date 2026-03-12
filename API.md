# Cytoscape Express API 接口文档

本文档详细说明了 Cytoscape Express 后端服务提供的所有 API 接口。

## 目录

- [拓扑相关接口](#拓扑相关接口)
  - [获取所有拓扑节点](#1-获取所有拓扑节点)
  - [获取节点拓扑信息](#2-获取节点拓扑信息)
  - [获取Cytoscape支持的拓扑图数据](#3-获取cytoscape支持的拓扑图数据)

---

## 拓扑相关接口

### 1. 获取所有拓扑节点
通过向资源端服务器访问接口`http://${process.env.SERVER_URL_BASE}/info/nodes`
获取系统中所有拓扑节点的列表。

**接口地址：**
```
/topology/info/nodes
```

**请求方式：**
- GET
- POST

**请求参数：**
无

**响应示例：**
```json
{
    "nodes": [
        {
            "hostname": "node1",
            "ip": "172.16.0.46"
        },
        {
            "hostname": "node24",
            "ip": "172.16.0.24"
        }
    ],
    "message": "成功"
}
```

---

### 2. 获取节点拓扑信息

根据IP地址通过向资源端服务器访问接口`http://${process.env.SERVER_URL_BASE}/info/node?ip=${ip}`获取指定节点的拓扑信息，并解析GPU拓扑数据。

**接口地址：**
```
GET /topology/info/node?ip={ip}&hostname={hostname}
```

**请求方式：**
- GET
- POST

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| ip | string | 是 | 节点的IP地址，例如：172.16.0.24 |
| hostname | string | 是 | 节点的主机名，例如：node24 |

**功能说明：**
1. 根据IP地址请求外部服务获取节点的原始拓扑数据
2. 根据hostname类型选择不同的解析策略：
   - 如果hostname不包含"node"：使用`parseGPUTopology`解析
   - 如果hostname包含"node"：使用`parseGPUTopology2`解析
3. 将解析后的拓扑数据保存到Neo4j数据库
4. 返回解析后的结构化拓扑数据

**响应示例：**
```json
{
  "matrixData": [
    {
      "device": "GPU0",
      "connections": {
        "GPU0": "X",
        "GPU1": "NV12",
        "NIC0": "PIX"
      },
      "cpu_affinity": "0-31",
      "numa_affinity": "0"
    }
  ],
  "legendData": {
    "X": "Self",
    "NV12": "NVLink Gen 1-2",
    "PIX": "PCIe x16 Gen3"
  }
}
```

---


### 3. 获取Cytoscape支持的拓扑图数据

获取适合Cytoscape.js前端库使用的拓扑图数据格式。

**接口地址：**
```
GET /topology/cytoscape?ip={ip}&hostname={hostname}
```

**请求方式：**
- GET
- POST

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| ip | string | 是 | 节点的IP地址，用于过滤节点 |
| hostname | string | 是 | 节点的主机名 |

**功能说明：**
1. 从Neo4j数据库查询所有节点和关系
2. 根据IP地址过滤节点（只返回ID以指定IP开头的节点）
3. 为每个节点设置以下属性：
   - `id`：节点唯一标识
   - `name`：节点名称
   - `depth`：节点层级深度（默认为3）
   - `x`, `y`：节点坐标（默认为'0'）
   - `width`, `height`：节点大小（默认为'30'）
   - `color`：节点颜色（基于拓扑聚类）
   - `shape`：节点形状（根据ID关键词自动匹配）
     - CPU → 矩形 (rectangle)
     - PCIe → 菱形 (diamond)
     - NIC → 三角形 (triangle)
     - GPU → 星形 (star)
     - QPI → 椭圆 (ellipse)
     - 其他 → 默认椭圆
4. 过滤depth=1的节点，不添加其连接边
5. 只添加类型为'CONNECTED_TO'的边
6. 按depth升序排序节点
7. 返回Cytoscape.js所需的elements格式

**节点形状映射规则：**
根据节点ID中的关键词自动匹配形状（不区分大小写）：
- 包含"cpu" → 矩形
- 包含"pcie" → 菱形
- 包含"nic" → 三角形
- 包含"gpu" → 星形
- 包含"qpi" → 椭圆
- 其他 → 默认椭圆

**响应示例：**
```json
{
  "elements": [
    {
      "group": "nodes",
      "data": {
        "id": "172.16.0.24-numa0",
        "name": "NUMA0",
        "depth": 2,
        "x": "0",
        "y": "0",
        "width": "30",
        "height": "30",
        "color": "255 0 0",
        "borderColor": "34 101 151",
        "textColor": "17 17 17",
        "shape": "ellipse",
        "text": "",
        "textFont": "1|Arial|8|0|WINDOWS|1|-11|0|0|0|0|0|0|0|1|0|0|0|0|Arial",
        "parent": "172.16.0.24"
      }
    },
    {
      "group": "edges",
      "data": {
        "id": "e0",
        "source": "172.16.0.24-numa0",
        "target": "172.16.0.24-gpu0"
      }
    }
  ]
}
```

---

## 数据结构说明

### 节点属性

| 属性名 | 类型 | 说明 |
|--------|------|------|
| id | string | 节点唯一标识符 |
| name | string | 节点显示名称 |
| depth | number | 节点层级深度（1=计算节点，2=NUMA/总线，3=CPU/设备，4=GPU/NIC） |
| parent | string | 父节点ID |
| x, y | string | 节点坐标 |
| width, height | string | 节点尺寸 |
| color | string | 节点颜色（RGB格式） |
| shape | string | 节点形状 |

### 边属性

| 属性名 | 类型 | 说明 |
|--------|------|------|
| id | string | 边唯一标识符 |
| source | string | 源节点ID |
| target | string | 目标节点ID |
| type | string | 连接类型（CONNECTED_TO、HAS等） |

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 500 | 服务器内部错误 |

---

## 使用示例


### 示例1：获取所有拓扑节点

```bash
curl "http://localhost:3000/topology/info/nodes"
```

### 示例2：获取节点拓扑信息

```bash
curl "http://localhost:3000/topology/info/node?ip=172.16.0.24&hostname=node24"
```

### 示例3：获取Cytoscape格式的拓扑图

```bash
curl "http://localhost:3000/topology/cytoscape?ip=172.16.0.24&hostname=node24"
```


---

## 注意事项

1. 所有接口支持GET和POST请求方式
2. IP地址和hostname参数必须正确提供
3. 查询结果可能受Neo4j数据库中的数据量限制
4. Cytoscape接口返回的数据已经过优化，可直接用于前端可视化
5. 节点颜色基于拓扑聚类算法自动生成
6. 节点形状根据ID关键词自动匹配，无需手动指定
