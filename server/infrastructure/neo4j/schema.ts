import { writeCypher } from './client'

/** Uniqueness constraints double as the indexes used to anchor every traversal. */
export const neo4jSchemaStatements = [
  'CREATE CONSTRAINT user_id IF NOT EXISTS FOR (n:User) REQUIRE n.id IS UNIQUE',
  'CREATE CONSTRAINT product_id IF NOT EXISTS FOR (n:Product) REQUIRE n.id IS UNIQUE',
  'CREATE CONSTRAINT category_id IF NOT EXISTS FOR (n:Category) REQUIRE n.id IS UNIQUE',
  'CREATE CONSTRAINT brand_name IF NOT EXISTS FOR (n:Brand) REQUIRE n.name IS UNIQUE',
  'CREATE CONSTRAINT device_id IF NOT EXISTS FOR (n:Device) REQUIRE n.id IS UNIQUE',
  'CREATE CONSTRAINT card_fingerprint IF NOT EXISTS FOR (n:Card) REQUIRE n.fingerprint IS UNIQUE',
  'CREATE CONSTRAINT address_key IF NOT EXISTS FOR (n:Address) REQUIRE n.key IS UNIQUE',
  'CREATE CONSTRAINT warehouse_id IF NOT EXISTS FOR (n:Warehouse) REQUIRE n.id IS UNIQUE',
  'CREATE INDEX user_name IF NOT EXISTS FOR (n:User) ON (n.name)',
  // Relationship property indexes, used by idempotent projection and reconciliation.
  'CREATE INDEX purchased_order IF NOT EXISTS FOR ()-[r:PURCHASED]-() ON (r.orderId)',
  'CREATE INDEX rated_review IF NOT EXISTS FOR ()-[r:RATED]-() ON (r.reviewId)',
]

/** Creates constraints and indexes and waits until they are online. Safe to run repeatedly. */
export async function ensureNeo4jSchema(): Promise<void> {
  for (const statement of neo4jSchemaStatements) await writeCypher(statement)
  await writeCypher('CALL db.awaitIndexes(300)')
}
