import { z } from 'zod'

/**
 * Environment configuration, usable from Nitro and from plain Bun scripts.
 * The defaults are the standard local ports. Bun reads `.env` automatically.
 */
const schema = z.object({
  MONGO_URI: z.string().default('mongodb://127.0.0.1:27017/?directConnection=true'),
  MONGO_DB: z.string().default('graphmart'),
  NEO4J_URI: z.string().default('bolt://127.0.0.1:7687'),
  NEO4J_USER: z.string().default('neo4j'),
  NEO4J_PASSWORD: z.string().default('graphmart123'),
  NEO4J_DATABASE: z.string().default('neo4j'),
  MYSQL_HOST: z.string().default('127.0.0.1'),
  MYSQL_PORT: z.coerce.number().default(3306),
  MYSQL_USER: z.string().default('graphmart'),
  MYSQL_PASSWORD: z.string().default('graphmart123'),
  MYSQL_DATABASE: z.string().default('graphmart'),
})

export const config = schema.parse(process.env)
