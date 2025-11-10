#!/usr/bin/env bun

/**
 * Debug Semantic Search
 * 
 * Check if vector search is working
 */

import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  process.env.NEO4J_URI!,
  neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!)
);

console.log('🔍 Debugging Vector Search\n');

const session = driver.session();

try {
  // Check if documents have embeddings
  console.log('1. Checking if documents have embeddings...\n');
  const docResult = await session.run(`
    MATCH (d:Document)
    WHERE d.scopeId = 'estimate-company'
    RETURN id(d) as nodeId,
           d.contextIds as contextIds,
           size(coalesce(d.embedding, [])) as embeddingSize,
           substring(d.text, 0, 80) as textPreview
    LIMIT 3
  `);

  docResult.records.forEach(record => {
    console.log(`Document node ID: ${record.get('nodeId')}`);
    console.log(`  contextIds: ${JSON.stringify(record.get('contextIds'))}`);
    console.log(`  embedding size: ${record.get('embeddingSize')}`);
    console.log(`  text: ${record.get('textPreview')}...\n`);
  });

  // Check if entities have embeddings
  console.log('\n2. Checking if entities have embeddings...\n');
  const entityResult = await session.run(`
    MATCH (e)
    WHERE e.scopeId = 'estimate-company' 
      AND (e:Person OR e:Company OR e:Concept)
    RETURN labels(e)[0] as label,
           e.name as name,
           e.contextIds as contextIds,
           size(coalesce(e.embedding, [])) as embeddingSize
    LIMIT 3
  `);

  entityResult.records.forEach(record => {
    console.log(`${record.get('label')}: ${record.get('name')}`);
    console.log(`  contextIds: ${JSON.stringify(record.get('contextIds'))}`);
    console.log(`  embedding size: ${record.get('embeddingSize')}\n`);
  });

  // Check vector indexes
  console.log('\n3. Checking vector indexes...\n');
  const indexResult = await session.run(`SHOW INDEXES`);
  
  const vectorIndexes = indexResult.records.filter(record => {
    const type = record.get('type');
    return type && type.includes('VECTOR');
  });

  if (vectorIndexes.length === 0) {
    console.log('❌ NO VECTOR INDEXES FOUND!');
    console.log('   This is why searches return nothing.\n');
    console.log('   Run: CALL db.index.vector.createNodeIndex(');
    console.log('     "entity_vector_index",');
    console.log('     "Entity",');
    console.log('     "embedding",');
    console.log('     1536,');
    console.log('     "cosine"');
    console.log('   )');
  } else {
    console.log('✅ Vector indexes found:');
    vectorIndexes.forEach(record => {
      console.log(`   - ${record.get('name')} (${record.get('type')})`);
    });
  }

  // Try a direct vector search
  console.log('\n4. Testing direct vector search (if indexes exist)...\n');
  
  if (vectorIndexes.length > 0) {
    // Create a simple embedding for "February 2024"
    const { OpenAIEmbeddingProvider } = await import('../../../akasha/src/services/providers/embedding/openai-embedding.provider');
    
    const embeddingProvider = new OpenAIEmbeddingProvider({
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'text-embedding-3-small',
    });
    
    const queryEmbedding = await embeddingProvider.generateEmbedding('February 2024 events decisions');
    
    console.log(`Generated query embedding (length: ${queryEmbedding.length})\n`);
    
    // Try searching documents
    try {
      const searchResult = await session.run(`
        CALL db.index.vector.queryNodes(
          'document_vector_index',
          10,
          $queryVector
        )
        YIELD node, score
        WHERE node.scopeId = 'estimate-company'
        RETURN id(node) as nodeId,
               node.contextIds as contextIds,
               score,
               substring(node.text, 0, 100) as preview
        LIMIT 5
      `, { queryVector: queryEmbedding });
      
      if (searchResult.records.length === 0) {
        console.log('❌ Document vector search returned 0 results');
      } else {
        console.log('✅ Document vector search results:');
        searchResult.records.forEach(record => {
          console.log(`   Score: ${record.get('score').toFixed(3)} - ${record.get('preview')}...`);
          console.log(`   contextIds: ${JSON.stringify(record.get('contextIds'))}`);
        });
      }
    } catch (err) {
      console.log(`❌ Document vector search failed: ${err}`);
    }
    
    // Try searching entities
    try {
      const entitySearchResult = await session.run(`
        CALL db.index.vector.queryNodes(
          'entity_vector_index',
          10,
          $queryVector
        )
        YIELD node, score
        WHERE node.scopeId = 'estimate-company'
        RETURN labels(node)[0] as label,
               node.name as name,
               node.contextIds as contextIds,
               score
        LIMIT 5
      `, { queryVector: queryEmbedding });
      
      if (entitySearchResult.records.length === 0) {
        console.log('\n❌ Entity vector search returned 0 results');
      } else {
        console.log('\n✅ Entity vector search results:');
        entitySearchResult.records.forEach(record => {
          console.log(`   Score: ${record.get('score').toFixed(3)} - ${record.get('label')}: ${record.get('name')}`);
          console.log(`   contextIds: ${JSON.stringify(record.get('contextIds'))}`);
        });
      }
    } catch (err) {
      console.log(`\n❌ Entity vector search failed: ${err}`);
    }
  }

} catch (error) {
  console.error('Error:', error);
} finally {
  await session.close();
  await driver.close();
}

