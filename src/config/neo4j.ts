import neo4j from 'neo4j-driver';

export const Neo4jDatabase = "test";
const driver = neo4j.driver(
  'bolt://localhost:7687', // 修改为你的 Neo4j 地址
  neo4j.auth.basic('neo4j', 'cytoscape') // 修改为你的用户名和密码
);

export default driver;