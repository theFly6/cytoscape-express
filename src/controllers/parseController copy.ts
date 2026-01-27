// controllers/parseController.ts

import { Request, Response } from 'express';

// import { mooreDataStr } from '../data/Moore';

import axios from 'axios';
import driver, { Neo4jDatabase } from '../config/neo4j';

// 获取所有拓扑节点
export const parseNodes = async (req: Request, res: Response) => {
    try {
        const response = await axios.post(`http://${process.env.SERVER_URL_BASE}/info/nodes`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: '解析错误' });
    }
}

// 拓扑字符串解析
export const parseNode = async (req: Request, res: Response) => {
    try {
        const { ip, hostname } = req.query as { ip: string, hostname: string };
        const response = await axios.post(`http://${process.env.SERVER_URL_BASE}/info/node?ip=${ip}`);
        
        // 将response.data经过解析转存储到neo4j中
        let data
        if(!hostname?.includes("node")){
            data = parseGPUTopology((response.data as any).topologyData);
            await saveNodeTopologyData(ip, hostname, data);
        }
        else {
            data = parseGPUTopology2((response.data as any).topologyData);
            await saveNodeTopologyData2(ip, hostname, data);
        } 
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: '解析错误' });
    }
}

// 将拓扑感知结果存储到neo4j中(第一版仅支持学校的感知)
// export const saveNodeTopologyData = async (ip: string, hostname: string, data: any) => {
//     console.log('即将准备saveNodeTopologyData', 'ip: ', ip, 'hostname: ', hostname);

//     if (!driver) throw new Error("Neo4j driver not initialized.");

//     const session = driver.session({ database: Neo4jDatabase });

//     try {
//         const matrixData = data.matrixData;
//         const computeNodeId = ip;

//         const firstGPU = matrixData.find((d: any) => d.device?.startsWith("GPU"));
//         const cpuAffinityRanges = firstGPU?.cpu_affinity?.split(",") || ['0-31', '64-95'];
//         const inferredNumaNodes = ['0', '1'];

//         const cmds: string[] = [];

//         // ================================================================================
//         // 1. Compute node MERGE
//         // ================================================================================
//         cmds.push(`
//             MERGE (c:Compute {id:'${computeNodeId}'})
//             ON CREATE SET c.name='${hostname}', c.ip='${ip}', c.depth=1, c.createdAt=datetime()
//             ON MATCH SET c.name='${hostname}', c.ip='${ip}', c.depth=1, c.createdAt=datetime()
//         `);

//         // ================================================================================
//         // 2. NUMA + CPU
//         // ================================================================================
//         for (let i = 0; i < inferredNumaNodes.length; i++) {
//             const numaId = `${computeNodeId}-numa${i}`;
//             const cpuId = `${computeNodeId}-cpu${i}`;
//             const affinity = cpuAffinityRanges[i] || '';

//             // NUMA
//             cmds.push(`
//                 MERGE (n:NUMA {id:'${numaId}'})
//                 ON CREATE SET n.name='NUMA${i}', n.parent='${computeNodeId}', n.depth=2
//                 ON MATCH SET n.updatedAt=datetime()
//             `);

//             // CPU
//             cmds.push(`
//                 MERGE (cpu:CPU {id:'${cpuId}'})
//                 ON CREATE SET cpu.name='CPU${i}', cpu.parent='${numaId}', cpu.depth=3,
//                     cpu.affinity_range='${affinity}', cpu.numa_affinity='${i}'
//                 ON MATCH SET cpu.updatedAt=datetime()
//             `);

//             // Relationship
//             cmds.push(`
//                 MATCH (c:Compute {id:'${computeNodeId}'}), (n:NUMA {id:'${numaId}'})
//                 MERGE (c)-[:HAS]->(n)
//             `);
//         }

//         // ================================================================================
//         // 3. QPI Bus
//         // ================================================================================
//         const qpiId = `${computeNodeId}-qpi`;
//         cmds.push(`
//             MERGE (b:Bus {id:'${qpiId}'})
//             ON CREATE SET b.name='QPI', b.type='QPI', b.parent='${computeNodeId}', b.depth=2
//             ON MATCH SET b.updatedAt=datetime()
//         `);

//         // ================================================================================
//         // 4. PCIe Switches
//         // ================================================================================
//         const pcisw0Id = `${computeNodeId}-pcie0`;
//         const pcisw1Id = `${computeNodeId}-pcie1`;
//         const numa0Id = `${computeNodeId}-numa0`;

//         cmds.push(`
//             MERGE (s:PCIeSwitch {id:'${pcisw0Id}'})
//             ON CREATE SET s.name='PCISW0', s.type='MPB', s.parent='${numa0Id}', s.depth=3
//             ON MATCH SET s.updatedAt=datetime()
//         `);

//         cmds.push(`
//             MERGE (s:PCIeSwitch {id:'${pcisw1Id}'})
//             ON CREATE SET s.name='PCISW1', s.type='MPB', s.parent='${numa0Id}', s.depth=3
//             ON MATCH SET s.updatedAt=datetime()
//         `);

//         // ================================================================================
//         // 5. NICs
//         // ================================================================================
//         const nicMap = {
//             "mlx5_2": "numa0",
//             "mlx5_3": "numa0",
//             "mlx5_4": "numa1",
//             "mlx5_5": "numa1"
//         };

//         for (const [name, numa] of Object.entries(nicMap)) {
//             const nicId = `${computeNodeId}-${name}`;
//             const parent = `${computeNodeId}-${numa}`;

//             cmds.push(`
//                 MERGE (n:NIC {id:'${nicId}'})
//                 ON CREATE SET n.name='${name.toUpperCase()}', n.parent='${parent}', n.depth=3
//                 ON MATCH SET n.updatedAt=datetime()
//             `);
//         }

//         // ================================================================================
//         // 6. GPUs
//         // ================================================================================
//         for (let i = 0; i < 8; i++) {
//             cmds.push(`
//                 MERGE (g:GPU {id:'${computeNodeId}-gpu${i}'})
//                 ON CREATE SET g.name='GPU${i}', g.parent='${numa0Id}', g.depth=3
//                 ON MATCH SET g.updatedAt=datetime()
//             `);
//         }

//         // ================================================================================
//         // 7. CONNECTED_TO relationships
//         // ================================================================================
//         // 辅助函数：根据组件名称获取完整的 ID
//         const getComponentId = (name: string): string => {
//             // 假设：
//             // - CPU0/CPU1 对应 numa0/numa1
//             // - PCISW0/PCISW1
//             // - MLX5_X
//             // - QPI
//             // - GPUX
            
//             if (name.startsWith("CPU")) {
//                 const index = name.slice(3); // '0' 或 '1'
//                 return `${computeNodeId}-cpu${index}`;
//             }
//             if (name.startsWith("PCISW")) {
//                 const index = name.slice(5); // '0' 或 '1'
//                 return `${computeNodeId}-pcie${index}`;
//             }
//             if (name.startsWith("MLX5_")) {
//                 const index = name.slice(5); // '2' 到 '5'
//                 return `${computeNodeId}-mlx5_${index}`;
//             }
//             if (name === "QPI") {
//                 return `${computeNodeId}-qpi`;
//             }
//             if (name.startsWith("GPU")) {
//                 const index = name.slice(3); // '0' 到 '7'
//                 return `${computeNodeId}-gpu${index}`;
//             }
//             // 如果有其他类型的节点，需要在这里补充
//             return ''; // 返回空字符串或抛出错误
//         };

//         const relationNames = [
//             ["CPU0","PCISW0"],["CPU0","PCISW1"],
//             ["CPU0","MLX5_2"],["CPU0","MLX5_3"],
//             ["CPU0","QPI"],["QPI","CPU1"],
//             ["CPU1","MLX5_4"],["CPU1","MLX5_5"],
//             ["MLX5_2","MLX5_3"],
//             ["MLX5_4","MLX5_5"], 
//             ["GPU0","PCISW0"],["GPU1","PCISW0"],["GPU2","PCISW0"],["GPU3","PCISW0"],
//             ["GPU4","PCISW1"],["GPU5","PCISW1"],["GPU6","PCISW1"],["GPU7","PCISW1"]
//         ];

//         const relationPairs = relationNames.map(([aName, bName]) => [
//             getComponentId(aName), 
//             getComponentId(bName)
//         ]).filter(([idA, idB]) => idA && idB); // 过滤掉无效的 ID

//         for (const [aId, bId] of relationPairs) {
//             cmds.push(`
//                 MATCH (x {id:'${aId}'}), (y {id:'${bId}'})
//                 MERGE (x)-[:CONNECTED_TO]->(y)
//             `);
//         }

//         // ================================================================================
//         // 8. Execute (Neo4j 5.x: one statement per run)
//         // ================================================================================
//         await session.writeTransaction(async tx => {
//             for (const stmt of cmds) {
//                 await tx.run(stmt);
//             }
//         });

//         console.log(`拓扑写入完成: ${hostname} (${ip})`);

//     } finally {
//         await session.close();
//     }
// };

// 假设 driver 和 Neo4jDatabase 已经定义

/**
 * 将拓扑感知结果存储到Neo4j中（基于物理层级结构）
 * @param {string} ip - 计算节点的IP
 * @param {string} hostname - 计算节点的主机名
 * @param {object} data - 拓扑数据，包含 matrixData
 */
export const saveNodeTopologyData = async (ip: string, hostname: string, data: any) => {
    console.log('即将准备saveNodeTopologyData (基于物理结构 - NIC连接到PCISW)', 'ip: ', ip, 'hostname: ', hostname);

    if (!driver) throw new Error("Neo4j driver not initialized.");

    const session = driver.session({ database: Neo4jDatabase });

    try {
        const matrixData = data.matrixData || [];
        const computeNodeId = ip;
        const cmds: string[] = [];
        
        // --------------------------------------------------------------------------------
        // 0. 动态识别 NUMA/CPU 组 并 推断 NIC 归属
        // --------------------------------------------------------------------------------
        const numaMap = new Map<string, number>(); // {numa_affinity_key: canonical_index}
        const numaInfoMap = new Map<number, { affinity: string, numaKey: string }>(); // {index: {affinity, numaKey}}
        // 存储所有设备的 NUMA Key，用于 NIC 推断
        const deviceNumaMap = new Map<string, string>(); // {deviceName: numaKey}
        
        // 第一次遍历：识别所有 GPU 定义的 NUMA 组，并存储 GPU 的归属
        matrixData.forEach((d: any) => {
            const numaKey = (d.numa_affinity || 'unknown').toString();
            // 仅处理具有有效 numa_affinity 的设备
            if (numaKey !== 'SYS' && numaKey !== 'unknown' && numaKey.trim() !== '') {
                if (!numaMap.has(numaKey)) {
                    const index = numaMap.size;
                    numaMap.set(numaKey, index);
                    numaInfoMap.set(index, { 
                        affinity: d.cpu_affinity || '', 
                        numaKey: numaKey 
                    });
                }
            }
            // 存储所有设备的归属（如果有 numa_affinity）
            if (numaKey !== 'SYS' && numaKey !== 'unknown' && numaKey.trim() !== '') {
                 deviceNumaMap.set(d.device, numaKey);
            }
        });

        // 第二次遍历：为缺少 numa_affinity 的 NIC 推断 NUMA 归属
        matrixData.forEach((d: any) => {
            if ((d.device.startsWith("NIC") || d.device.startsWith("mlx5")) && !d.numa_affinity) {
                const connections = d.connections || {};
                // 寻找连接类型为 MPB (Multiple PCIe Bridges) 的 GPU
                for (const [connectedDevice, connectionType] of Object.entries(connections)) {
                    if (connectedDevice.startsWith("GPU") && connectionType === 'MPB') {
                        const inferredNumaKey = deviceNumaMap.get(connectedDevice);
                        if (inferredNumaKey) {
                            // 推断成功，将 NIC 归属到该 NUMA
                            deviceNumaMap.set(d.device, inferredNumaKey);
                            break; 
                        }
                    }
                }
            }
        });
        
        const numNuma = numaMap.size;
        const canonicalNumaIds: string[] = [];
        const canonicalCpuIds: string[] = [];
        const canonicalPciswIds: string[] = [];
        const mt2BusId = `${computeNodeId}-mt2-bus`; // 新增 MT2 总线 ID

        // 辅助函数：根据设备名称获取规范的 ID
        const getCanonicalDeviceId = (name: string): string => `${computeNodeId}-${name.toLowerCase()}`;

        // --------------------------------------------------------------------------------
        // 1. Compute node MERGE
        // --------------------------------------------------------------------------------
        cmds.push(`
            MERGE (c:Compute {id:'${computeNodeId}'})
            ON CREATE SET c.name='${hostname}', c.ip='${ip}', c.depth=1, c.createdAt=datetime()
            ON MATCH SET c.name='${hostname}', c.ip='${ip}', c.depth=1, c.updatedAt=datetime()
        `);
        
        // --------------------------------------------------------------------------------
        // 2. 动态创建 NUMA + CPU + PCIeSwitch 节点及 HAS 关系
        // --------------------------------------------------------------------------------
        
        for (let i = 0; i < numNuma; i++) {
            const numaId = `${computeNodeId}-numa${i}`;
            const cpuId = `${computeNodeId}-cpu${i}`;
            const pciswId = `${computeNodeId}-pcisw${i}`; 

            canonicalNumaIds.push(numaId);
            canonicalCpuIds.push(cpuId);
            canonicalPciswIds.push(pciswId);

            const info = numaInfoMap.get(i)!;
            
            // NUMA
            cmds.push(`
                MERGE (n:NUMA {id:'${numaId}'})
                ON CREATE SET n.name='NUMA${i}', n.parent='${computeNodeId}', n.depth=2, n.numa_key='${info.numaKey}'
                ON MATCH SET n.updatedAt=datetime(), n.numa_key='${info.numaKey}'
            `);

            // CPU
            cmds.push(`
                MERGE (cpu:CPU {id:'${cpuId}'})
                ON CREATE SET cpu.name='CPU${i}', cpu.parent='${numaId}', cpu.depth=3,
                    cpu.affinity_range='${info.affinity}', cpu.numa_affinity='${info.numaKey}'
                ON MATCH SET cpu.updatedAt=datetime(), cpu.affinity_range='${info.affinity}'
            `);

            // PCIeSwitch (作为 CPU 的直接连接点)
            cmds.push(`
                MERGE (s:PCIeSwitch {id:'${pciswId}'})
                ON CREATE SET s.name='PCISW${i}', s.type='MPB', s.parent='${numaId}', s.depth=3
                ON MATCH SET s.updatedAt=datetime()
            `);

            // Compute -> NUMA 关系
            cmds.push(`
                MATCH (c:Compute {id:'${computeNodeId}'}), (n:NUMA {id:'${numaId}'})
                MERGE (c)-[:HAS]->(n)
            `);

            // NUMA -> CPU, NUMA -> PCIeSwitch 关系 (层级关系)
            cmds.push(`
                MATCH (n:NUMA {id:'${numaId}'}), (cpu:CPU {id:'${cpuId}'}), (s:PCIeSwitch {id:'${pciswId}'})
                MERGE (n)-[:HAS_COMPONENT]->(cpu)
                MERGE (n)-[:HAS_COMPONENT]->(s)
            `);

            // CPU -> PCIeSwitch 关系 (物理连接)
            cmds.push(`
                MATCH (cpu:CPU {id:'${cpuId}'}), (s:PCIeSwitch {id:'${pciswId}'})
                MERGE (cpu)-[:CONNECTED_TO {type:'PCIE_BRIDGE'}]->(s)
            `);
        }

        // --------------------------------------------------------------------------------
        // 3. QPI Bus (CPU 互联总线)
        // --------------------------------------------------------------------------------
        const qpiId = `${computeNodeId}-qpi`;
        cmds.push(`
            MERGE (b:Bus {id:'${qpiId}'})
            ON CREATE SET b.name='QPI', b.type='QPI', b.parent='${computeNodeId}', b.depth=2
            ON MATCH SET b.updatedAt=datetime()
        `);
        
        // CPU 之间通过 QPI 连接
        canonicalCpuIds.forEach((cpuId, index) => {
            // CPU -> QPI
            cmds.push(`
                MATCH (cpu:CPU {id:'${cpuId}'}), (q:Bus {id:'${qpiId}'})
                MERGE (cpu)-[:CONNECTED_TO {type:'INTER_CPU'}]->(q)
            `);
            // QPI -> Next CPU (形成链式连接)
            if (index < numNuma - 1) {
                 const nextCpuId = canonicalCpuIds[index + 1];
                 cmds.push(`
                    MATCH (q:Bus {id:'${qpiId}'}), (nextCpu:CPU {id:'${nextCpuId}'})
                    MERGE (q)-[:CONNECTED_TO {type:'INTER_CPU'}]->(nextCpu)
                `);
            }
        });

        // --------------------------------------------------------------------------------
        // 3B. MT2 Bus (GPU 互联总线) (新增)
        // --------------------------------------------------------------------------------
        cmds.push(`
            MERGE (b:Bus {id:'${mt2BusId}'})
            ON CREATE SET b.name='MT2 Bus', b.type='MT2', b.parent='${computeNodeId}', b.depth=2
            ON MATCH SET b.updatedAt=datetime()
        `);


        // --------------------------------------------------------------------------------
        // 4A. 创建所有 GPU/NIC 节点及其与 NUMA/PCISW 的连接
        // --------------------------------------------------------------------------------
        
        matrixData.forEach((d: any) => {
            const deviceName = d.device; 
            
            let numaKey = (d.numa_affinity || 'unknown').toString();
            
            // 如果是 NIC，则使用推断的 numaKey
            if (deviceName.startsWith("NIC") || deviceName.startsWith("mlx5")) {
                 numaKey = deviceNumaMap.get(deviceName) || numaKey;
            }

            const canonicalIndex = numaMap.get(numaKey);
            
            // 只有当设备名称存在且能找到归属的 NUMA 时才创建节点
            if (!deviceName || canonicalIndex === undefined) {
                 if (deviceName.startsWith("NIC") || deviceName.startsWith("mlx5")) {
                     console.warn(`跳过 NIC ${deviceName}: 无法找到或推断其 NUMA 归属 (${numaKey})`);
                 }
                return; 
            }
            
            const deviceId = getCanonicalDeviceId(deviceName);
            const numaId = canonicalNumaIds[canonicalIndex];
            const pciswId = canonicalPciswIds[canonicalIndex]; // 使用 PCISW ID

            let nodeLabel = '';
            // 判断设备类型
            if (deviceName.startsWith("GPU")) {
                nodeLabel = 'GPU';
            } else if (deviceName.startsWith("NIC") || deviceName.startsWith("mlx5")) {
                nodeLabel = 'NIC';
            } else {
                return; // 跳过其他未建模的设备类型
            }

            // A. 创建设备节点 (并关联到 NUMA 父节点)
            cmds.push(`
                MATCH (n:NUMA {id:'${numaId}'})
                MERGE (dev:${nodeLabel} {id:'${deviceId}'})
                ON CREATE SET dev.name='${deviceName.toUpperCase()}', dev.parent='${numaId}', dev.depth=3, dev.numa_affinity='${numaKey}', dev.createdAt=datetime()
                ON MATCH SET dev.updatedAt=datetime(), dev.numa_affinity='${numaKey}'

                MERGE (n)-[:HAS_COMPONENT]->(dev)
            `);

            // B. 创建关键连接 
            if (nodeLabel === 'GPU') {
                // 1. GPU 连接到本地 PCIe Switch (保持不变)
                cmds.push(`
                    MATCH (g:GPU {id:'${deviceId}'}), (s:PCIeSwitch {id:'${pciswId}'})
                    MERGE (g)-[:CONNECTED_TO {type:'PCIE_SWITCH'}]->(s)
                `);
                
                // 2. GPU 连接到 MT2 Bus (新增)
                cmds.push(`
                    MATCH (g:GPU {id:'${deviceId}'}), (b:Bus {id:'${mt2BusId}'})
                    MERGE (g)-[:CONNECTED_TO {type:'MT2_LINK'}]->(b)
                `);
            } else if (nodeLabel === 'NIC') {
                // NIC 连接到本地 PCIe Switch (修改: 从 CPU 改为 PCISW)
                cmds.push(`
                    MATCH (n:NIC {id:'${deviceId}'}), (s:PCIeSwitch {id:'${pciswId}'})
                    MERGE (n)-[:CONNECTED_TO {type:'PCIE_SWITCH'}]->(s)
                `);
                
                // *** 移除 NIC 之间 SPB 连接的创建，留给 4B 阶段处理 ***
            }
        });


        // --------------------------------------------------------------------------------
        // 4B. 创建 NIC 之间的 SPB 连接 (确保在节点 MERGE 之后执行)
        // --------------------------------------------------------------------------------
        
        matrixData.forEach((d: any) => {
            const deviceName = d.device; 

            // 仅处理 NIC 设备
            if (deviceName.startsWith("NIC") || deviceName.startsWith("mlx5")) {
                const deviceId = getCanonicalDeviceId(deviceName);
                const connections = d.connections || {};

                for (const [otherDeviceName, connectionType] of Object.entries(connections)) {
                    // 仅关注 SPB 连接，并且确保只连接到其他 NIC
                    if (connectionType === 'SPB' && (otherDeviceName.startsWith("NIC") || otherDeviceName.startsWith("mlx5"))) {
                        const otherDeviceId = getCanonicalDeviceId(otherDeviceName);

                        // 避免重复创建和自连接 (deviceId < otherDeviceId)
                        if (deviceId < otherDeviceId) {
                            cmds.push(`
                                MATCH (x:NIC {id:'${deviceId}'}), (y:NIC {id:'${otherDeviceId}'})
                                MERGE (x)-[:CONNECTED_TO {type:'SPB_LINK'}]->(y)
                            `);
                        }
                    }
                }
            }
        });


        // --------------------------------------------------------------------------------
        // 5. Execute
        // --------------------------------------------------------------------------------
        await session.writeTransaction(async tx => {
            for (const stmt of cmds) {
                await tx.run(stmt);
            }
        });

        console.log(`拓扑写入完成: ${hostname} (${ip})`);

    } finally {
        await session.close();
    }
};


export const saveNodeTopologyData2 = async (ip: string, hostname: string, data: any) => {
    console.log('即将准备 saveNodeTopologyData2 (针对 NVLink/PXB 架构)', 'ip: ', ip, 'hostname: ', hostname);

    if (!driver) throw new Error("Neo4j driver not initialized.");
    const session = driver.session({ database: Neo4jDatabase });

    try {
        const matrixData = data.matrixData || [];
        const computeNodeId = ip;
        const cmds: string[] = [];
        
        // --------------------------------------------------------------------------------
        // 0. 动态识别 NUMA/CPU 组
        // --------------------------------------------------------------------------------
        const numaMap = new Map<string, number>(); 
        const numaInfoMap = new Map<number, { affinity: string, numaKey: string }>(); 
        const deviceNumaMap = new Map<string, string>(); 
        
        matrixData.forEach((d: any) => {
            const numaKey = (d.numa_affinity || 'unknown').toString();
            if (numaKey !== 'SYS' && numaKey !== 'unknown' && numaKey.trim() !== '') {
                if (!numaMap.has(numaKey)) {
                    const index = numaMap.size;
                    numaMap.set(numaKey, index);
                    numaInfoMap.set(index, { 
                        affinity: d.cpu_affinity || '', 
                        numaKey: numaKey 
                    });
                }
            }
            if (numaKey !== 'SYS' && numaKey !== 'unknown' && numaKey.trim() !== '') {
                 deviceNumaMap.set(d.device, numaKey);
            }
        });

        // NIC NUMA 归属推断 (针对 PXB 类型)
        matrixData.forEach((d: any) => {
            if ((d.device.startsWith("NIC") || d.device.startsWith("mlx5")) && !d.numa_affinity) {
                const connections = d.connections || {};
                for (const [connectedDevice, connectionType] of Object.entries(connections)) {
                    // 在这种架构中，NIC 通过 PXB 连接到 GPU
                    if (connectedDevice.startsWith("GPU") && (connectionType === 'PXB' || connectionType === 'PIX')) {
                        const inferredNumaKey = deviceNumaMap.get(connectedDevice);
                        if (inferredNumaKey) {
                            deviceNumaMap.set(d.device, inferredNumaKey);
                            break; 
                        }
                    }
                }
            }
        });
        
        const numNuma = numaMap.size;
        const canonicalNumaIds: string[] = [];
        const canonicalCpuIds: string[] = [];
        const canonicalPciswIds: string[] = [];
        const nvlinkBusId = `${computeNodeId}-nvlink-bus`; // NVLink 总线

        const getCanonicalDeviceId = (name: string): string => `${computeNodeId}-${name.toLowerCase()}`;

        // 1. Compute node
        cmds.push(`
            MERGE (c:Compute {id:'${computeNodeId}'})
            ON CREATE SET c.name='${hostname}', c.ip='${ip}', c.depth=1, c.createdAt=datetime()
            ON MATCH SET c.name='${hostname}', c.ip='${ip}', c.depth=1, c.updatedAt=datetime()
        `);
        
        // 2. NUMA + CPU + PCIeSwitch
        for (let i = 0; i < numNuma; i++) {
            const numaId = `${computeNodeId}-numa${i}`;
            const cpuId = `${computeNodeId}-cpu${i}`;
            const pciswId = `${computeNodeId}-pcisw${i}`; 

            canonicalNumaIds.push(numaId);
            canonicalCpuIds.push(cpuId);
            canonicalPciswIds.push(pciswId);

            const info = numaInfoMap.get(i)!;
            
            cmds.push(`
                MERGE (n:NUMA {id:'${numaId}'})
                ON CREATE SET n.name='NUMA${i}', n.parent='${computeNodeId}', n.depth=2, n.numa_key='${info.numaKey}'
                MERGE (cpu:CPU {id:'${cpuId}'})
                ON CREATE SET cpu.name='CPU${i}', cpu.parent='${numaId}', cpu.depth=3, cpu.affinity_range='${info.affinity}'
                MERGE (s:PCIeSwitch {id:'${pciswId}'})
                ON CREATE SET s.name='PXB${i}', s.type='PXB', s.parent='${numaId}', s.depth=3
                
                WITH n, cpu, s
                MATCH (c:Compute {id:'${computeNodeId}'})
                MERGE (c)-[:HAS]->(n)
                MERGE (n)-[:HAS_COMPONENT]->(cpu)
                MERGE (n)-[:HAS_COMPONENT]->(s)
                MERGE (cpu)-[:CONNECTED_TO {type:'PCIE_HOST_BRIDGE'}]->(s)
            `);
        }

        // 3. NVLink Bus
        cmds.push(`
            MERGE (b:Bus {id:'${nvlinkBusId}'})
            ON CREATE SET b.name='NVLink Fabric', b.type='NVLINK', b.parent='${computeNodeId}', b.depth=2
        `);

        // 4. GPU & NIC Nodes
        matrixData.forEach((d: any) => {
            const deviceName = d.device; 
            let numaKey = (d.numa_affinity || 'unknown').toString();
            if (deviceName.startsWith("NIC") || deviceName.startsWith("mlx5")) {
                 numaKey = deviceNumaMap.get(deviceName) || numaKey;
            }

            const canonicalIndex = numaMap.get(numaKey);
            if (!deviceName || canonicalIndex === undefined) return; 
            
            const deviceId = getCanonicalDeviceId(deviceName);
            const pciswId = canonicalPciswIds[canonicalIndex];
            const isGPU = deviceName.startsWith("GPU");

            cmds.push(`
                MERGE (dev:${isGPU ? 'GPU' : 'NIC'} {id:'${deviceId}'})
                ON CREATE SET dev.name='${deviceName.toUpperCase()}', dev.numa_affinity='${numaKey}', dev.depth=4
                WITH dev
                MATCH (s:PCIeSwitch {id:'${pciswId}'})
                MERGE (dev)-[:CONNECTED_TO {type:'PCIE_LINK'}]->(s)
            `);

            if (isGPU) {
                // GPU 连接到 NVLink Bus
                cmds.push(`
                    MATCH (g:GPU {id:'${deviceId}'}), (b:Bus {id:'${nvlinkBusId}'})
                    MERGE (g)-[:CONNECTED_TO {type:'NVLINK'}]->(b)
                `);
            }
        });

        // 5. 执行事务
        await session.writeTransaction(async tx => {
            for (const stmt of cmds) {
                await tx.run(stmt);
            }
        });

        console.log(`NVLink 拓扑写入完成: ${hostname}`);

    } finally {
        await session.close();
    }
};


/**
 * 将原始的 GPU 拓扑字符串解析为结构化数据和图例。
 * @param text 原始拓扑矩阵文本。
 * @returns 包含解析后的矩阵数据和图例的元组：[matrix_data, legend_data]
 */
export const parseGPUTopology = (text: string): { matrixData: any[], legendData: Record<string, string> } => {
    const lines = text.trim().split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length === 0) {
        return { matrixData: [], legendData: {} };
    }

    // 1. 提取表头 (Header)
    let headerLine = lines[0]
        .replace("CPU Affinity", "CPU_Affinity")
        .replace("NUMA Affinity", "NUMA_Affinity");
    
    // 使用双空格分割，以应对对齐时的多个空格
    const headers = headerLine.split(/\s+/).filter(h => h.length > 0);

    const matrixData: any[] = [];
    const legendData: Record<string, string> = {};
    
    let parsingLegend = false;
    
    // 从第二行开始遍历
    for (const line of lines.slice(1)) {
        if (line.startsWith("Legend:")) {
            parsingLegend = true;
            continue;
        }
            
        if (parsingLegend) {
            // 解析图例，例如 "X = Self"
            // 使用正则表达式确保只匹配第一个 "=" 符号，且能处理开头的空格
            const match = line.match(/^(\s*[A-Z]{1,4})\s*=\s*(.*)/);
            if (match) {
                const key = match[1].trim();
                const desc = match[2].trim();
                legendData[key] = desc;
            }
        } else {
            // 解析矩阵数据行
            const parts = line.split(/\s+/).filter(p => p.length > 0);

            if (parts.length === 0) continue;
            
            // 第一列是设备名称 (Row Device)
            const rowDevice = parts[0];
            const rowInfo: any = { device: rowDevice };
            
            // 找出属于矩阵连接的列数 (去掉最后的 Affinity 列)
            const matrixColsCount = headers.filter(h => !h.includes("Affinity")).length;
            
            const connections: Record<string, string> = {};
            
            // 矩阵连接信息
            for (let i = 0; i < matrixColsCount; i++) {
                // 原始数据中设备名是第一列，所以连接信息从 parts[1] 开始
                if (i + 1 < parts.length) {
                    const targetDevice = headers[i];
                    connections[targetDevice] = parts[i + 1];
                }
            }
            
            rowInfo.connections = connections;
            
            // 提取 Affinity 信息
            if (parts.length > matrixColsCount + 1) {
                 // 倒数第二列是 CPU Affinity (CPU_Affinity)
                 rowInfo.cpu_affinity = parts[parts.length - 2];
                 // 最后一列是 NUMA Affinity (NUMA_Affinity)
                 rowInfo.numa_affinity = parts[parts.length - 1];
            }
            
            matrixData.push(rowInfo);
        }
    }

    return { matrixData, legendData };
    // return [matrixData, legendData];
};
export const parseGPUTopology2 = (text: string): { matrixData: any[], legendData: Record<string, string> } => {
    // 预处理：统一换行符并过滤空行
    const lines = text.trim().split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length === 0) return { matrixData: [], legendData: {} };

    // 1. 规范化表头处理
    // 处理 CPU Affinity -> CPU_Affinity, NUMA Affinity -> NUMA_Affinity, GPU NUMA ID -> GPU_NUMA_ID
    let headerLine = lines[0]
        .replace(/CPU Affinity/g, "CPU_Affinity")
        .replace(/NUMA Affinity/g, "NUMA_Affinity")
        .replace(/GPU NUMA ID/g, "GPU_NUMA_ID");
    
    const headers = headerLine.split(/\s+/).filter(h => h.length > 0);

    // 确定特殊的属性列索引
    const cpuIdx = headers.indexOf("CPU_Affinity");
    const numaIdx = headers.indexOf("NUMA_Affinity");
    // 矩阵连接列的数量 = 第一个属性列之前的列数
    const matrixColsCount = cpuIdx !== -1 ? cpuIdx : headers.length;

    const matrixData: any[] = [];
    const legendData: Record<string, string> = {};
    let parsingLegend = false;
    let parsingNICLegend = false;

    for (const line of lines.slice(1)) {
        // 状态切换
        if (line.startsWith("Legend:")) {
            parsingLegend = true;
            continue;
        }
        if (line.startsWith("NIC Legend:")) {
            parsingNICLegend = true;
            parsingLegend = false;
            continue;
        }

        if (parsingLegend) {
            // 支持 "X = Self" 或 "X  = Self"
            const match = line.match(/^([A-Z0-9#]{1,5})\s*=\s*(.*)/);
            if (match) legendData[match[1].trim()] = match[2].trim();
        } 
        else if (parsingNICLegend) {
            // 解析 "NIC0: mlx5_0"
            const match = line.match(/^(NIC\d+):\s*(.*)/);
            if (match) legendData[match[1]] = match[2];
        } 
        else {
            // 解析矩阵数据行
            const parts = line.split(/\s+/).filter(p => p.length > 0);
            if (parts.length === 0 || !parts[0].match(/^(GPU|NIC|mlx)/i)) continue;

            const rowDevice = parts[0];
            const rowInfo: any = { 
                device: rowDevice,
                connections: {} 
            };

            // 填充矩阵连接信息 (从索引1开始)
            for (let i = 0; i < matrixColsCount; i++) {
                const targetDevice = headers[i];
                if (parts[i + 1]) {
                    rowInfo.connections[targetDevice] = parts[i + 1];
                }
            }

            // 动态提取属性 (不再使用固定末尾索引)
            // 获取 CPU_Affinity
            if (cpuIdx !== -1 && parts[cpuIdx + 1]) {
                rowInfo.cpu_affinity = parts[cpuIdx + 1];
            }
            // 获取 NUMA_Affinity
            if (numaIdx !== -1 && parts[numaIdx + 1]) {
                rowInfo.numa_affinity = parts[numaIdx + 1];
            }

            matrixData.push(rowInfo);
        }
    }

    return { matrixData, legendData };
};