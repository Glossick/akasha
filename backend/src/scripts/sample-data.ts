/**
 * Script to create sample knowledge graph data in Neo4j
 * Run with: bun run backend/src/scripts/sample-data.ts
 */

import { Neo4jService } from '../services/neo4j.service';

async function createSampleData() {
  const neo4j = new Neo4jService();

  try {
    await neo4j.connect();
    console.log('Connected to Neo4j');

    // Create sample entities and relationships
    const queries = [
      // Create entities
      `CREATE (alice:Person {name: 'Alice', age: 30, occupation: 'Software Engineer'})`,
      `CREATE (bob:Person {name: 'Bob', age: 35, occupation: 'Data Scientist'})`,
      `CREATE (charlie:Person {name: 'Charlie', age: 28, occupation: 'Product Manager'})`,
      `CREATE (company:Company {name: 'TechCorp', industry: 'Technology', founded: 2010})`,
      `CREATE (project:Project {name: 'GraphRAG System', status: 'Active', description: 'Building a GraphRAG system with Bun and Neo4j'})`,

      // Create relationships
      `MATCH (a:Person {name: 'Alice'}), (c:Company {name: 'TechCorp'}) CREATE (a)-[:WORKS_FOR {since: 2020, role: 'Senior Engineer'}]->(c)`,
      `MATCH (b:Person {name: 'Bob'}), (c:Company {name: 'TechCorp'}) CREATE (b)-[:WORKS_FOR {since: 2018, role: 'Lead Data Scientist'}]->(c)`,
      `MATCH (alice:Person {name: 'Alice'}), (bob:Person {name: 'Bob'}) CREATE (alice)-[:COLLABORATES_WITH {projects: 3}]->(bob)`,
      `MATCH (alice:Person {name: 'Alice'}), (project:Project {name: 'GraphRAG System'}) CREATE (alice)-[:WORKS_ON {role: 'Lead Developer'}]->(project)`,
      `MATCH (bob:Person {name: 'Bob'}), (project:Project {name: 'GraphRAG System'}) CREATE (bob)-[:WORKS_ON {role: 'Data Architect'}]->(project)`,
      `MATCH (charlie:Person {name: 'Charlie'}), (project:Project {name: 'GraphRAG System'}) CREATE (charlie)-[:MANAGES]->(project)`,
      `MATCH (charlie:Person {name: 'Charlie'}), (company:Company {name: 'TechCorp'}) CREATE (charlie)-[:WORKS_FOR {since: 2015, role: 'VP of Product'}]->(company)`,
    ];

    console.log('Creating sample data...');
    for (const query of queries) {
      await neo4j.executeQuery(query);
      console.log(`Executed: ${query.substring(0, 50)}...`);
    }

    // Verify data
    const countResult = await neo4j.executeQuery<{ count: number }>(
      'MATCH (n) RETURN count(n) as count'
    );
    const relCountResult = await neo4j.executeQuery<{ count: number }>(
      'MATCH ()-[r]->() RETURN count(r) as count'
    );

    console.log('\n✅ Sample data created successfully!');
    console.log(`   Entities: ${countResult[0]?.count || 0}`);
    console.log(`   Relationships: ${relCountResult[0]?.count || 0}`);

    // Show sample query
    console.log('\n📊 Sample query to test:');
    console.log('   Query: "Who works on the GraphRAG System?"');
    console.log('   Or: "What is the relationship between Alice and Bob?"');
  } catch (error) {
    console.error('❌ Error creating sample data:', error);
    throw error;
  } finally {
    await neo4j.disconnect();
  }
}

// Run if executed directly
if (import.meta.main) {
  createSampleData()
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

