import neo4j from 'neo4j-driver';

export const Neo4jDatabase = "test2";
const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'cytoscape')
);

export default driver;


// 在线预览
// http://localhost:7474/browser/preview/
// MATCH (n) DETACH DELETE n;
// MATCH p=()-[]->() RETURN p;
