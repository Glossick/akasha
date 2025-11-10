#!/usr/bin/env bun

/**
 * Load Knowledge Base Script
 * 
 * Loads EstiMate's 6-month knowledge base into Akasha with multi-dimensional context tagging.
 * 
 * Required environment variables:
 * - NEO4J_URI
 * - NEO4J_USER
 * - NEO4J_PASSWORD
 * - OPENAI_API_KEY (for embeddings)
 * - DEEPSEEK_API_KEY (for LLM)
 * 
 * Usage:
 *   bun run scripts/load-knowledge.ts
 */

import { akasha } from '../../../akasha/src/factory';
import type { Scope } from '../../../akasha/src/types';
import { readFileSync } from 'fs';
import { join } from 'path';

// Check environment variables
const requiredEnvVars = ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD', 'OPENAI_API_KEY', 'DEEPSEEK_API_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  process.exit(1);
}

// Load data manifest
const manifestPath = join(__dirname, '../data-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

async function loadKnowledgeBase() {
  console.log('🚀 Loading EstiMate Knowledge Base into Akasha\n');

  // Create scope for EstiMate company
  const scope: Scope = {
    id: 'estimate-company',
    type: 'organization',
    name: 'EstiMate Company Knowledge Base',
    metadata: {
      description: 'Internal knowledge base for EstiMate B2B SaaS startup',
      timeRange: '2024-01 to 2024-06',
      documents: manifest.documents.length,
    },
  };

  console.log(`📦 Initializing Akasha with scope: ${scope.name}`);
  console.log(`   Provider: OpenAI embeddings + DeepSeek LLM\n`);

  const kg = akasha({
    neo4j: {
      uri: process.env.NEO4J_URI!,
      user: process.env.NEO4J_USER!,
      password: process.env.NEO4J_PASSWORD!,
    },
    scope,
    providers: {
      embedding: {
        type: 'openai',
        config: {
          apiKey: process.env.OPENAI_API_KEY!,
          model: 'text-embedding-3-small',
        },
      },
      llm: {
        type: 'deepseek',
        config: {
          apiKey: process.env.DEEPSEEK_API_KEY!,
          model: 'deepseek-chat',
        },
      },
    },
  });

  await kg.initialize();
  console.log('✅ Akasha initialized\n');

  try {
    let successCount = 0;
    let errorCount = 0;

    console.log(`📚 Loading ${manifest.documents.length} documents...\n`);

    for (const [index, docMeta] of manifest.documents.entries()) {
      const docNum = index + 1;
      const progress = `[${docNum}/${manifest.documents.length}]`;

      try {
        // Read document content
        const docPath = join(__dirname, '../data', docMeta.file);
        const content = readFileSync(docPath, 'utf-8');

        // Build context IDs from multiple dimensions
        // Each dimension becomes a separate contextId for flexible filtering
        // We'll learn the SAME text multiple times with different contextIds
        // Deduplication will ensure it's only stored once, but contextIds accumulate
        const contextIds: string[] = [];
        
        if (docMeta.contexts.time) {
          contextIds.push(`time:${docMeta.contexts.time}`);
        }
        
        if (docMeta.contexts.team && docMeta.contexts.team.length > 0) {
          docMeta.contexts.team.forEach(member => {
            contextIds.push(`team:${member}`);
          });
        }
        
        if (docMeta.contexts.client && docMeta.contexts.client.length > 0) {
          docMeta.contexts.client.forEach(client => {
            contextIds.push(`client:${client}`);
          });
        }
        
        if (docMeta.contexts.source) {
          contextIds.push(`source:${docMeta.contexts.source}`);
        }
        
        if (docMeta.contexts.topic && docMeta.contexts.topic.length > 0) {
          docMeta.contexts.topic.forEach(topic => {
            contextIds.push(`topic:${topic}`);
          });
        }

        console.log(`${progress} Loading: ${docMeta.file}`);
        console.log(`   Context IDs: ${contextIds.join(', ')}`);

        // Learn the document ONCE for each contextId
        // Deduplication ensures the document is only stored once
        // But each learn() call appends its contextId to the document's contextIds array
        let result;
        for (const [idx, contextId] of contextIds.entries()) {
          const contextName = idx === 0 
            ? `${docMeta.file.replace('.md', '')}` 
            : `${docMeta.file.replace('.md', '')}-${contextId}`;
          
          result = await kg.learn(content, {
            contextId,
            contextName,
            validFrom: docMeta.validFrom ? new Date(docMeta.validFrom) : undefined,
            includeEmbeddings: false,
          });
          
          // Only print details on first learn (subsequent ones are deduped)
          if (idx === 0) {
            console.log(`   ✅ Created: ${result.created.entities} entities, ${result.created.relationships} relationships`);
            console.log(`   📄 Document: ${result.created.document === 1 ? 'New' : 'Reused'} (ID: ${result.document.id.substring(0, 8)}...)`);
          }
        }

        // Show final accumulated contextIds
        console.log(`   🏷️  Accumulated ${contextIds.length} context dimensions\n`);

        successCount++;
      } catch (error) {
        console.error(`${progress} ❌ Error loading ${docMeta.file}:`);
        console.error(`   ${error instanceof Error ? error.message : String(error)}\n`);
        errorCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Successfully loaded: ${successCount} documents`);
    console.log(`   ❌ Errors: ${errorCount} documents`);

    // Query some stats
    console.log('\n🔍 Querying knowledge base stats...');
    
    const entities = await kg.listEntities({ limit: 1000 });
    const relationships = await kg.listRelationships({ limit: 1000 });
    const documents = await kg.listDocuments({ limit: 1000 });

    console.log(`   📄 Total documents: ${documents.length}`);
    console.log(`   🏷️  Total entities: ${entities.length}`);
    console.log(`   🔗 Total relationships: ${relationships.length}`);

    // Show entity label distribution
    const labelCounts = entities.reduce((acc, entity) => {
      acc[entity.label] = (acc[entity.label] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\n   Entity types:');
    Object.entries(labelCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([label, count]) => {
        console.log(`      ${label}: ${count}`);
      });

    console.log('\n✨ Knowledge base loading complete!');
    console.log('\n💡 Next steps:');
    console.log('   - Run query script: bun run scripts/query-knowledge.ts');
    console.log('   - Try multi-dimensional queries to see context filtering in action');
    console.log('   - Explore temporal queries with validAt parameter');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Stack trace:', error.stack);
    }
  } finally {
    await kg.cleanup();
    console.log('\n🧹 Cleaned up connections');
  }
}

loadKnowledgeBase();

