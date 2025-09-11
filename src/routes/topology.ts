// src/routes/topology.ts
import express from 'express'
import { getTopologyInfo } from '../controllers/topologyController';

const router = express.Router()

// 接口实现：通过nodeID查询拓扑信息
router.all('/info/:nodeID', getTopologyInfo)

export default router