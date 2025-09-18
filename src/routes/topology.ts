// src/routes/topology.ts
import express from 'express'
import { getTopologyInfo, getTopologyGraph, getCytoscapeTopology } from '../controllers/topologyController';

const router = express.Router()

// 接口实现：通过nodeID查询拓扑信息
router.all('/info/:nodeID', getTopologyInfo)

// 接口实现：获取拓扑图数据
router.all('/graph', getTopologyGraph)

// 接口实现：获取cytoscape支持的拓扑图数据格式
router.all('/cytoscape', getCytoscapeTopology)


export default router