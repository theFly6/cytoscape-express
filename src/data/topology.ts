
// 生成随机利用率的工具函数
export const getRandomUtilization = (min: number, max: number): number => {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2))
}

// 模拟节点数据
export const mockNodeData = (nodeID: string) => {
  // 根据节点ID生成不同配置，使数据更真实
  const isGpuNode = nodeID.includes('gpu')

  return {
    nodeID,
    memory: {
      total: isGpuNode ? '32GB' : '16GB',
      used: isGpuNode ?
        `${(Math.random() * 10 + 5).toFixed(2)}GB` :
        `${(Math.random() * 5 + 2).toFixed(2)}GB`,
      utilization: getRandomUtilization(30, 80) // 30%-80% 利用率
    },
    // 节点内连接
    internalConnections: [
      {
        type: 'NVLINK',
        bandwidth: `${600 + Math.random() * 300 | 0}GB/s`,
        latency: `${10 + Math.random() * 40 | 0}ns`,
        utilization: getRandomUtilization(20, 60)
      },
      {
        type: 'QPI',
        bandwidth: `${19 + Math.random() * 13 | 0}GB/s`,
        latency: `${30 + Math.random() * 70 | 0}ns`,
        utilization: getRandomUtilization(40, 75)
      },
      {
        type: 'PCIe',
        bandwidth: [16, 32, 64, 128][Math.floor(Math.random() * 4)] + 'GB/s',
        latency: `${200 + Math.random() * 800 | 0}ns`,
        utilization: getRandomUtilization(35, 90)
      }
    ]
  }
}

// 模拟链路数据
export const mockLinkData = (nodeID: string) => {
  // 为每个节点生成2-4个连接的其他节点
  const linkCount = 2 + Math.floor(Math.random() * 3)
  const links = []

  for (let i = 0; i < linkCount; i++) {
    // 生成一个与当前nodeID不同的目标节点ID
    let targetNodeID: string
    do {
      targetNodeID = `node-${Math.floor(Math.random() * 100).toString().padStart(3, '0')}`
    } while (targetNodeID === nodeID)

    links.push({
      from: nodeID,
      to: targetNodeID,
      type: 'Infiniband',
      bandwidth: '25GB/s',
      latency: '0.6μs',
      utilization: getRandomUtilization(10, 60) // 10%-60% 利用率
    })
  }

  return links
}

const getRandomColor = () => {
  // 生成随机颜色
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return `${r} ${g} ${b}`;
}
const clusters = {
  'cp-001-gpu': getRandomColor(),
  'cp-002-gpu': getRandomColor(),
  'cp-001-cpu': getRandomColor(),
  'cp-002-cpu': getRandomColor(),
  'cp-001-numa': getRandomColor(),
  'cp-002-numa': getRandomColor(),
  'cp-001-nvlink':  getRandomColor(),
  'cp-002-nvlink':  getRandomColor(),
}

// 拓扑聚类
export const topologyCluster: Record<string, any> = {
  'sw-001': '238 238 238',
  'lg-001': '238 238 238',
  'cp-001': '238 238 238',
  'cp-002': '238 238 238',
  'default': (id: string) => {
    // 根据ID前缀分配颜色
    if (id.startsWith('cp-001-gpu')) return clusters['cp-001-gpu'];
    if (id.startsWith('cp-002-gpu')) return clusters['cp-002-gpu'];
    if (id.startsWith('cp-001-cpu')) return clusters['cp-001-cpu'];
    if (id.startsWith('cp-002-cpu')) return clusters['cp-002-cpu'];
    if (id.startsWith('cp-001-numa')) return clusters['cp-001-numa'];
    if (id.startsWith('cp-002-numa')) return clusters['cp-002-numa'];
    if (id.startsWith('cp-001-nvlink')) return clusters['cp-001-nvlink'];
    if (id.startsWith('cp-002-nvlink')) return clusters['cp-002-nvlink'];
    return getRandomColor(); // 随机颜色
  }
}