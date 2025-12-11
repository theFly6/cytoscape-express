// src/routes/topology.ts
import express from 'express'
import { getTopologyInfo, getTopologyGraph, getCytoscapeTopology } from '../controllers/topologyController';

import { parseNode, parseNodes } from '../controllers/parseController';

const router = express.Router()

// 接口实现：获取所有拓扑节点
router.all('/info/nodes', parseNodes)

// 接口实现：获取节点的拓扑信息
router.all('/info/node', parseNode)

// 接口实现：通过nodeID查询拓扑信息
router.all('/info/:nodeID', getTopologyInfo)

// 接口实现：获取拓扑图数据
router.all('/graph', getTopologyGraph)

// 接口实现：获取cytoscape支持的拓扑图数据格式
router.all('/cytoscape', getCytoscapeTopology)



export default router