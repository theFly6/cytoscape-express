
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