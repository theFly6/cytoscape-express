// controllers/topologyController.ts
import { Request, Response } from 'express';
import { mockNodeData, mockLinkData } from '../data/topology';

import driver, { Neo4jDatabase } from '../config/neo4j';
import { topologyCluster } from '../data/topology';

// 根据 nodeID 查询拓扑信息
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


// 从neo4j获取拓扑图数据
export const getTopologyGraph = async (req: Request, res: Response) => {
  const session = driver.session({ database: Neo4jDatabase });
  try {
    const result = await session.run(
      'MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 1000'
    );
    const nodeInfo: any[] = []
    const linkInfo: any[] = []
    result.records.map(record => {
      nodeInfo.push({
        name: record.get('n').properties.name || 'defaultName',
        id: record.get('n').properties.id,
        ...record.get('n')
      })
      console.log('record.get(\'r\')', record.get('r'));
      linkInfo.push(record.get('r'))
    });
    const nodes = {
      nodes: nodeInfo,
      links: linkInfo
    }
    res.json(nodes);
  } catch (error) {
    res.status(500).json({ error: error });
  } finally {
    await session.close();
  }
};

// 获取 cytoscape 支持的拓扑图数据格式（不计算 depth 和 parent）
export const getCytoscapeTopology = async (req: Request, res: Response) => {
  const session = driver.session({ database: Neo4jDatabase });
  const { ip, hostname } = req.query;
  console.log('getTopologyGraph: ip', ip, 'hostname', hostname);
  try {
    const result = await session.run(
      'MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 1000'
    );

    const nodeMap: Map<string, any> = new Map();
    const edgeList: any[] = [];
    result.records.forEach(record => {
      const n = record.get('n');
      const m = record.get('m');
      const r = record.get('r');

      if(n.properties.id.startsWith(ip) && m.properties.id.startsWith(ip)){
          // 处理节点 n 和 m
        [n, m].forEach(node => {
          const id = node.properties.id;
          if (!nodeMap.has(id)) {
            const data: any = {
              id,
              name: node.properties.name,
              depth: Number(node.properties.depth ?? 3),  // 默认 depth 为 3
              x: '0',
              y: '0',
              width: '30',
              height: '30',
              color: topologyCluster[id] || topologyCluster['default'](id), // 使用聚类颜色
              borderColor: '34 101 151',
              textColor: '17 17 17',
              shape: 'Ellipse',
              text: '',
              textFont: '1|Arial|8|0|WINDOWS|1|-11|0|0|0|0|0|0|0|1|0|0|0|0|Arial'
            };

            // 根据 ID 设置 depth 和 parent
            if (data.depth !== 1) {
              data.parent = node.properties.parent;
            }

            nodeMap.set(id, {
              group: 'nodes',
              data
            });
          }
        });

        // 如果n.properties.depth=1，则不添加边
        if (n.properties.depth != 1) {
          // 添加边
          edgeList.push({
            group: 'edges',
            data: {
              id: `e${edgeList.length}`,
              source: n.properties.id,
              target: m.properties.id
              // source: n.properties.name,
              // target: m.properties.name
            }
          });
        }
      }
    });

    // ✅ 按 depth 升序排序节点
    const sortedNodes = Array.from(nodeMap.values()).sort(
      (a, b) => (a.data.depth || 0) - (b.data.depth || 0)
    );

    // 返回 Cytoscape 所需格式
    const elements = [
      ...sortedNodes,
      ...edgeList
    ];
    // console.log('edgeList', edgeList);
    res.json({ elements });
  } catch (err) {
    console.error('Neo4j 查询失败', err);
    res.status(500).json({ error: '查询失败' });
  } finally {
    await session.close();
  }
};
