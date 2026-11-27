import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'

// `db.ts` manages its own database copies, so it ignores `.env`, which may point at your
// installed servers. Import this before anything that reads the configuration.
Object.assign(process.env, parseEnv(readFileSync(resolve(import.meta.dir, '../.env.private.example'), 'utf8')))
