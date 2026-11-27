# Code conventions

- TypeScript strict. No `any`; no `as` casts unless a driver type forces it.
- Layering: `server/api/**` (validate input, call one module function, return the DTO) ->
  `server/modules/<feature>/` (`*.repository.ts` holds queries, `*.service.ts` holds
  business logic when there is any) -> `server/infrastructure/**` (clients).
  Do not add a service file that only forwards to a repository.
- `server/infrastructure`, `server/modules`, `server/utils` and `scripts` use **relative
  imports only** and no Nuxt/Nitro auto-imports, because plain Bun scripts and `bun test`
  import them. Route handlers in `server/api` may use Nitro auto-imports (`defineEventHandler`).
- Request validation with zod through `server/utils/http.ts`.
- Response shapes come from `shared/types/api.ts`. That file is the contract: do not change
  existing shapes; adding an optional field is allowed if you say so in your report.
- Every database call made for an HTTP request goes through a `Tracer`
  (`server/infrastructure/trace.ts`) so the UI can show it.
- Neo4j: always parameterised Cypher; wrap integers in `int()`. The only values that may be
  interpolated into Cypher text are variable-length bounds, after zod validation.
- SQL: always `?` placeholders.
- Comments explain why (a design decision, a database behaviour), not what.
- Files stay focused; split a file that grows past about 250 lines.
