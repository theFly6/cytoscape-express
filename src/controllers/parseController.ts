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
        const { ip, hostname } = req.query;
        const response = await axios.post(`http://${process.env.SERVER_URL_BASE}/info/node?ip=${ip}`);
        const data = parseGPUTopology((response.data as any).topologyData);
        // 将response.data经过解析转存储到neo4j中
        await saveNodeTopologyData(ip as string, hostname as string, data);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: '解析错误' });
    }
}

// 将拓扑感知结果存储到neo4j中
export const saveNodeTopologyData = async (ip: string, hostname: string, data: any) => {
    console.log('即将准备saveNodeTopologyData', 'ip: ', ip, 'hostname: ', hostname);

    if (!driver) throw new Error("Neo4j driver not initialized.");

    const session = driver.session({ database: Neo4jDatabase });

    try {
        const matrixData = data.matrixData;
        const computeNodeId = ip;

        const firstGPU = matrixData.find((d: any) => d.device?.startsWith("GPU"));
        const cpuAffinityRanges = firstGPU?.cpu_affinity?.split(",") || ['0-31', '64-95'];
        const inferredNumaNodes = ['0', '1'];

        const cmds: string[] = [];

        // ================================================================================
        // 1. Compute node MERGE
        // ================================================================================
        cmds.push(`
            MERGE (c:Compute {id:'${computeNodeId}'})
            ON CREATE SET c.name='${hostname}', c.ip='${ip}', c.depth=1, c.createdAt=datetime()
            ON MATCH SET c.name='${hostname}', c.ip='${ip}', c.depth=1, c.createdAt=datetime()
        `);

        // ================================================================================
        // 2. NUMA + CPU
        // ================================================================================
        for (let i = 0; i < inferredNumaNodes.length; i++) {
            const numaId = `${computeNodeId}-numa${i}`;
            const cpuId = `${computeNodeId}-cpu${i}`;
            const affinity = cpuAffinityRanges[i] || '';

            // NUMA
            cmds.push(`
                MERGE (n:NUMA {id:'${numaId}'})
                ON CREATE SET n.name='NUMA${i}', n.parent='${computeNodeId}', n.depth=2
                ON MATCH SET n.updatedAt=datetime()
            `);

            // CPU
            cmds.push(`
                MERGE (cpu:CPU {id:'${cpuId}'})
                ON CREATE SET cpu.name='CPU${i}', cpu.parent='${numaId}', cpu.depth=3,
                    cpu.affinity_range='${affinity}', cpu.numa_affinity='${i}'
                ON MATCH SET cpu.updatedAt=datetime()
            `);

            // Relationship
            cmds.push(`
                MATCH (c:Compute {id:'${computeNodeId}'}), (n:NUMA {id:'${numaId}'})
                MERGE (c)-[:HAS]->(n)
            `);
        }

        // ================================================================================
        // 3. QPI Bus
        // ================================================================================
        const qpiId = `${computeNodeId}-qpi`;
        cmds.push(`
            MERGE (b:Bus {id:'${qpiId}'})
            ON CREATE SET b.name='QPI', b.type='QPI', b.parent='${computeNodeId}', b.depth=2
            ON MATCH SET b.updatedAt=datetime()
        `);

        // ================================================================================
        // 4. PCIe Switches
        // ================================================================================
        const pcisw0Id = `${computeNodeId}-pcie0`;
        const pcisw1Id = `${computeNodeId}-pcie1`;
        const numa0Id = `${computeNodeId}-numa0`;

        cmds.push(`
            MERGE (s:PCIeSwitch {id:'${pcisw0Id}'})
            ON CREATE SET s.name='PCISW0', s.type='MPB', s.parent='${numa0Id}', s.depth=3
            ON MATCH SET s.updatedAt=datetime()
        `);

        cmds.push(`
            MERGE (s:PCIeSwitch {id:'${pcisw1Id}'})
            ON CREATE SET s.name='PCISW1', s.type='MPB', s.parent='${numa0Id}', s.depth=3
            ON MATCH SET s.updatedAt=datetime()
        `);

        // ================================================================================
        // 5. NICs
        // ================================================================================
        const nicMap = {
            "mlx5_2": "numa0",
            "mlx5_3": "numa0",
            "mlx5_4": "numa1",
            "mlx5_5": "numa1"
        };

        for (const [name, numa] of Object.entries(nicMap)) {
            const nicId = `${computeNodeId}-${name}`;
            const parent = `${computeNodeId}-${numa}`;

            cmds.push(`
                MERGE (n:NIC {id:'${nicId}'})
                ON CREATE SET n.name='${name.toUpperCase()}', n.parent='${parent}', n.depth=3
                ON MATCH SET n.updatedAt=datetime()
            `);
        }

        // ================================================================================
        // 6. GPUs
        // ================================================================================
        for (let i = 0; i < 8; i++) {
            cmds.push(`
                MERGE (g:GPU {id:'${computeNodeId}-gpu${i}'})
                ON CREATE SET g.name='GPU${i}', g.parent='${numa0Id}', g.depth=3
                ON MATCH SET g.updatedAt=datetime()
            `);
        }

        // ================================================================================
        // 7. CONNECTED_TO relationships
        // ================================================================================
        // 辅助函数：根据组件名称获取完整的 ID
        const getComponentId = (name: string): string => {
            // 假设：
            // - CPU0/CPU1 对应 numa0/numa1
            // - PCISW0/PCISW1
            // - MLX5_X
            // - QPI
            // - GPUX
            
            if (name.startsWith("CPU")) {
                const index = name.slice(3); // '0' 或 '1'
                return `${computeNodeId}-cpu${index}`;
            }
            if (name.startsWith("PCISW")) {
                const index = name.slice(5); // '0' 或 '1'
                return `${computeNodeId}-pcie${index}`;
            }
            if (name.startsWith("MLX5_")) {
                const index = name.slice(5); // '2' 到 '5'
                return `${computeNodeId}-mlx5_${index}`;
            }
            if (name === "QPI") {
                return `${computeNodeId}-qpi`;
            }
            if (name.startsWith("GPU")) {
                const index = name.slice(3); // '0' 到 '7'
                return `${computeNodeId}-gpu${index}`;
            }
            // 如果有其他类型的节点，需要在这里补充
            return ''; // 返回空字符串或抛出错误
        };

        const relationNames = [
            ["CPU0","PCISW0"],["CPU0","PCISW1"],
            ["CPU0","MLX5_2"],["CPU0","MLX5_3"],
            ["CPU0","QPI"],["QPI","CPU1"],
            ["CPU1","MLX5_4"],["CPU1","MLX5_5"],
            ["MLX5_2","MLX5_3"],
            ["MLX5_4","MLX5_5"], 
            ["GPU0","PCISW0"],["GPU1","PCISW0"],["GPU2","PCISW0"],["GPU3","PCISW0"],
            ["GPU4","PCISW1"],["GPU5","PCISW1"],["GPU6","PCISW1"],["GPU7","PCISW1"]
        ];

        const relationPairs = relationNames.map(([aName, bName]) => [
            getComponentId(aName), 
            getComponentId(bName)
        ]).filter(([idA, idB]) => idA && idB); // 过滤掉无效的 ID

        for (const [aId, bId] of relationPairs) {
            cmds.push(`
                MATCH (x {id:'${aId}'}), (y {id:'${bId}'})
                MERGE (x)-[:CONNECTED_TO]->(y)
            `);
        }

        // ================================================================================
        // 8. Execute (Neo4j 5.x: one statement per run)
        // ================================================================================
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