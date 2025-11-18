# EstiMate Knowledge Base Demo

This demo showcases Akasha's multi-dimensional context filtering, temporal querying, and deduplication capabilities using a realistic B2B SaaS startup scenario.

## Scenario

**EstiMate** is a B2B SaaS platform for automating estimation processes. This knowledge base contains 6 months (Jan-Jun 2024) of company knowledge:

- **Founders**: Henry (sales/marketing) and Steven (engineering)
- **Employee**: Sarah (customer success, hired March 2024)
- **10 Clients**: From small contractors to large enterprises
- **20 Documents**: Meeting notes, Slack conversations, customer calls, decision logs, support tickets, internal docs

## Story Arcs

1. **Pricing Evolution**: $99 flat → tiered pricing → grandfather clauses → churn threats
2. **Architecture Debate**: Monolith vs microservices, performance optimization
3. **Feature Prioritization**: PDF vs API, conflicting stakeholder needs
4. **Hiring Journey**: From 2 founders to 3 employees, Steven's burnout
5. **Funding**: From bootstrapped to $500k seed round
6. **Client Drama**: MegaConstruct near-churn, PrecisionEng power user, TinyBuilders ghost

## Context Dimensions

Documents are tagged with multiple context dimensions:

- **Time**: `2024-01` through `2024-06` (monthly granularity)
- **Team**: `henry`, `steven`, `sarah`
- **Client**: `buildcorp`, `consultpro`, `megaconstruct`, `precisioneng`, etc.
- **Source**: `meeting-notes`, `slack`, `customer-call`, `decision-log`, `support-ticket`, `internal-doc`
- **Topic**: `pricing`, `architecture`, `features`, `hiring`, `fundraising`, `customer-success`, `product`, `sales`, `operations`

## What This Demonstrates

### ✨ Core Akasha Capabilities

1. **Multi-Dimensional Context Filtering**
   - Query across any combination of dimensions
   - `contexts: ['time:2024-02', 'client:megaconstruct']` → only Feb docs about MegaConstruct
   - No schema changes needed—just arrays of strings

2. **Entity Deduplication**
   - "Henry" mentioned in 15+ documents → stored once, linked to all contexts
   - Same for "MegaConstruct", "pricing", "API", etc.
   - Deep context overlap: entities belong to 10+ different context combinations

3. **Temporal Complexity**
   - Track how facts evolve: "Pricing is $99" → "Pricing has 3 tiers" → "MegaConstruct gets special deal"
   - Point-in-time queries: "What was true in February?"
   - `validFrom` dates on all documents

4. **Ambiguity & Conflict Detection**
   - Henry wants PDF priority, Steven wants API priority
   - MegaConstruct enthusiastic in sales calls, complaining in support tickets
   - Marketing claims "10x faster" but data shows "5x faster"
   - Akasha surfaces these conflicts in query results

5. **Document + Entity Strategy**
   - Documents provide full text context
   - Entities provide structured relationships
   - Strategy `'both'` (default) combines for best results

6. **Scope Isolation**
   - All data isolated to `estimate-company` scope
   - Would be completely invisible to other scopes/tenants

## Installation & Setup

### Prerequisites

```bash
# Required environment variables
export NEO4J_URI="bolt://localhost:7687"
export NEO4J_USER="neo4j"
export NEO4J_PASSWORD="your-password"
export OPENAI_API_KEY="your-openai-key"
export DEEPSEEK_API_KEY="your-deepseek-key"
```

### Neo4j Setup

Make sure you have Neo4j running with vector index support (v5.0+).

## Usage

### 1. Load Knowledge Base

```bash
cd /Users/sushiltailor/glossick/akasha/demo/knowledge-base
bun run scripts/load-knowledge.ts
```

This will:
- Create scope `estimate-company` 
- Load all 20 documents with multi-dimensional context tags
- Extract entities and relationships using DeepSeek LLM
- Generate embeddings using OpenAI
- Show statistics on entities, relationships, document deduplication

**Expected**: ~2-3 minutes to load all documents (depends on API latency)

### 2. Query Knowledge Base

```bash
bun run scripts/query-knowledge.ts
```

This runs 10 pre-defined queries demonstrating:

1. **Temporal**: "What happened in February 2024?"
2. **Client**: "What do we know about MegaConstruct?"
3. **Topic**: "How did pricing strategy evolve?"
4. **Team**: "What was Steven working on?"
5. **Source**: "What feedback came from customer calls?"
6. **Multi-dimensional**: "Architecture decisions involving MegaConstruct?"
7. **Temporal range**: "Key developments in Q1 2024?"
8. **Ambiguity**: "Did Henry and Steven agree on pricing?"
9. **Temporal comparison**: "How did morale change Apr→Jun?"
10. **Complex**: "How did stakeholders influence features?"

Each query shows:
- The question and context filters applied
- The generated answer
- Query statistics (timing, entities/docs found)
- Which documents/entities were retrieved

Press Enter between queries to proceed at your own pace.

### 3. Custom Queries (Optional)

Modify `query-knowledge.ts` to add your own queries, or use it as a template for interactive CLI querying.

## File Structure

```
knowledge-base/
├── README.md (this file)
├── NARRATIVE.md (detailed company story)
├── data/
│   ├── 2024-01/
│   │   ├── meeting-founders-kickoff.md
│   │   ├── slack-pricing-discussion.md
│   │   └── customer-call-buildcorp-onboarding.md
│   ├── 2024-02/ (3 documents)
│   ├── 2024-03/ (3 documents)
│   ├── 2024-04/ (3 documents)
│   ├── 2024-05/ (4 documents)
│   └── 2024-06/ (4 documents)
├── data-manifest.json (metadata for all documents)
└── scripts/
    ├── load-knowledge.ts (loads data into Akasha)
    └── query-knowledge.ts (runs example queries)
```

## Key Insights from Queries

### What Works Brilliantly

1. **No Schema Changes for New Contexts**
   - Added `client:precisioneng` context → no migration needed
   - Contexts are just strings in arrays
   - Query filtering happens at runtime, not storage time

2. **Entity Reuse is Automatic**
   - "Henry" appears in 15 documents across 8 context combinations
   - Stored once, linked everywhere
   - No duplicate detection logic needed—handled by Akasha

3. **Temporal Queries are Natural**
   - "What was true in February?" → filter by `time:2024-02`
   - Facts have `validFrom` dates → point-in-time accuracy
   - Evolution over time is queryable without version tables

4. **Ambiguity is Surfaced, Not Hidden**
   - Query "Did they agree on pricing?" returns docs showing disagreement
   - LLM synthesizes: "Henry preferred X, Steven preferred Y"
   - Conflicting information enriches understanding rather than breaking queries

5. **Scope Isolation is Bulletproof**
   - All data tagged with `estimate-company` scope
   - Different tenant would create separate scope → zero data leakage
   - No way to accidentally cross-query

### Stress Test Results

| Metric | Result | Assessment |
|--------|--------|------------|
| **Deep Context Overlaps** | Henry in 10+ context combos | ✅ Handled elegantly |
| **Multi-Dimensional Queries** | 4-5 dimensions simultaneously | ✅ Fast filtering |
| **Temporal Complexity** | Facts evolve over 6 months | ✅ Point-in-time works |
| **Ambiguity Detection** | Conflicting views surfaced | ✅ LLM synthesizes both |
| **Entity Deduplication** | Same entities reused | ✅ Automatic, no dups |
| **Document Deduplication** | Same text reused | ✅ Hash-based detection |

## Steelman Arguments for Akasha

### 1. Context Flexibility Without Schema Migrations

**Problem**: Most knowledge bases require schema changes to add new organizational dimensions.

**Akasha's Solution**: Contexts are string arrays. Adding `client:newclient` requires zero schema changes. Just tag documents with new contextId.

**Demo Proof**: We have 5 context dimensions with arbitrary combinations. No CREATE TABLE, no ALTER TABLE, no migrations.

### 2. Deduplication at Scale

**Problem**: Same person/company/concept mentioned in many docs → either duplicate storage or complex normalization.

**Akasha's Solution**: Entities deduplicate automatically by name within scope. Documents deduplicate by content hash. Each accumulates contextIds arrays showing where they appear.

**Demo Proof**: "Henry" in 15 documents → 1 entity with 15 contextId values. "MegaConstruct" in 8 documents → 1 entity. "Pricing" as topic spans 10 documents → relationships link them all.

### 3. Temporal Reasoning Without Version Tables

**Problem**: Tracking how facts change over time usually requires complex version tables, soft deletes, or snapshot systems.

**Akasha's Solution**: Every document/entity has `_recordedAt`, `_validFrom`, `_validTo` metadata. Query with `validAt` to see point-in-time state.

**Demo Proof**: "What was pricing in February?" vs "What was pricing in May?" return different answers. No version tables, no snapshots—just timestamp filtering.

### 4. Ambiguity as Feature, Not Bug

**Problem**: Conflicting information breaks traditional knowledge bases or requires manual resolution.

**Akasha's Solution**: Multiple documents with different perspectives coexist. LLM synthesis includes all views, explicitly noting disagreements.

**Demo Proof**: Query "Did founders agree on architecture?" returns both Steven's "we need microservices" and Henry's "optimize monolith first". LLM answer acknowledges debate and resolution.

### 5. Multi-Tenancy Without Complexity

**Problem**: Multi-tenant systems require complex row-level security, tenant columns everywhere, risk of data leakage.

**Akasha's Solution**: Scope ID tags everything. Queries auto-filter by scope. Impossible to cross-query without explicit scope change.

**Demo Proof**: All queries auto-scoped to `estimate-company`. Creating second scope for different company would be invisible to these queries.

## Next Steps

1. **Try Your Own Scenario**
   - Create documents for your domain
   - Define your context dimensions
   - Load and query

2. **Experiment with Query Strategies**
   - Try `strategy: 'documents'` vs `'entities'` vs `'both'`
   - See how results differ

3. **Test Temporal Queries**
   - Add `validAt: new Date('2024-03-15')` to queries
   - See how answers change for point-in-time

4. **Scale Testing**
   - Add 100+ documents
   - See how deduplication handles high-overlap scenarios
   - Measure query performance with large context arrays

## Troubleshooting

### "Documents not loading"
- Check environment variables are set
- Verify Neo4j is running and accessible
- Check API keys are valid (OpenAI + DeepSeek)

### "Queries returning no results"
- Ensure data was loaded first (`load-knowledge.ts`)
- Check scope ID matches (`estimate-company`)
- Verify context IDs match manifest format

### "Slow query performance"
- Check Neo4j vector index exists: `SHOW INDEXES`
- Increase `limit` parameter if getting partial results
- Consider lowering `similarityThreshold` for broader matches

## License

Part of Akasha demo. See main Akasha LICENSE.

