// controllers/topologyController.ts
import { Request, Response } from 'express';
import { mockNodeData, mockLinkData } from '../data/topology';

export const getTopologyInfo = (req: Request, res: Response) => {

  try {
    const { nodeID } = req.params
    
    if (!nodeID || typeof nodeID !== 'string') {
      return res.status(400).json({
        error: '无效的nodeID参数，必须为字符串类型'
      })
    }
    
    // 生成节点和链路数据
    const nodeInfo = mockNodeData(nodeID)
    const linkInfo = mockLinkData(nodeID)
    
    // 返回整合后的信息
    res.json({
      node: nodeInfo,
      links: linkInfo,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('拓扑信息查询错误:', error)
    res.status(500).json({
      error: '查询拓扑信息时发生服务器错误'
    })
  }
};