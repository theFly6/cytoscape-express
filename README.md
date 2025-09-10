# Cytoscape Express

Cytoscape Express 是一个基于 Node.js 和 Express 的后端服务，旨在为图数据的可视化和操作提供 API 支持。项目结构清晰，适合与前端图可视化库（如 Cytoscape.js）集成。

## 项目结构

```
cytoscape-express/
├── package.json
├── tsconfig.json
├── src/
│   ├── app.ts              # Express 应用主入口
│   ├── server.ts           # 服务启动入口
│   ├── config/             # 配置相关文件夹
│   ├── controllers/        # 控制器（业务逻辑）
│   ├── data/
│   │   ├── graph.ts        # 图数据模型与操作
│   │   └── topology.ts     # 拓扑数据模型与操作
│   └── routes/
│       ├── graph.ts        # 图相关路由
│       └── topology.ts     # 拓扑相关路由
```

## 快速开始

1. **安装依赖**

```powershell
npm install
npm install -g ts-node
```

2. **启动服务**

```powershell
ts-node ./src/server.ts
```

默认监听端口可在 `src/config` 或相关配置文件中修改。

## 主要功能

- 提供图数据的增删查改 API
- 支持拓扑结构的管理与查询
- 适合与 Cytoscape.js 等前端库对接

## 主要文件说明

- `src/app.ts`：Express 应用初始化，加载中间件和路由。
- `src/server.ts`：启动 HTTP 服务。
- `src/data/graph.ts`：定义图结构及相关操作。
- `src/data/topology.ts`：定义拓扑结构及相关操作。
- `src/routes/graph.ts`：图相关 API 路由。
- `src/routes/topology.ts`：拓扑相关 API 路由。

## 依赖

- Node.js
- Express
- TypeScript

## 贡献

欢迎提交 issue 或 PR 改进本项目。

## License

MIT
