<img src="assets/icon.svg" width="64" height="64" alt="">

# GraphMart

An online shop that does things its old MySQL version struggled with, using **MongoDB** for what
things are (products, orders) and **Neo4j** for how they connect (people, purchases, fraud,
routes). Fullstack **Nuxt 4** with **Nuxt UI**, running on **Bun**.

## Start

Requirements: Bun, MongoDB Server 8, MySQL Server 8, a Java 21 runtime (Neo4j Desktop ships one)
and the Neo4j Community zip (tested with 2026.03.1) from neo4j.com, unpacked into `.tools/`. The
databases, their data and Neo4j itself are not part of the repository. These scripts have only been
run on Windows.

```bash
git clone https://github.com/TeodorPetrovic/graphmart.git
cd graphmart
bun install
bun run db:setup                 # once
bun run db:up                    # starts all three databases
bun run seed                     # same dataset into all three, about 4 minutes
bun run bench                    # measures all 17 scenarios
bun run build && bun run start   # http://localhost:3000
```

`bun run dev` gives hot reload while editing. Present with the production build, and start it with
`bun run start`: that script raises Bun's 10 second connection timeout, which long benchmark runs
and graph rebuilds exceed.

The databases are **private copies**: data in `.data/`, ports 27027 (MongoDB), 3317 (MySQL),
7697 and 7484 (Neo4j), bound to this computer only. Installed database services and Neo4j Desktop
projects are not touched. MongoDB runs without a password and the others use the development
password in `.env.example`, so do not expose them. `docker-compose.yml` is meant to replace
`db:setup` and `db:up` for Docker users, but it has not been tested.

Stop them with `bun run db:down`. After a reboot run `db:up` again.

## For the presentation

| Document                                               | Content                                              |
| ------------------------------------------------------ | ---------------------------------------------------- |
| [docs/LECTURE-1.md](docs/LECTURE-1.md)                 | Class 1: the shop, flexible products and safe orders |
| [docs/LECTURE-2.md](docs/LECTURE-2.md)                 | Class 2: connections, fraud and delivery             |
| [docs/SQL-BEFORE-AFTER.md](docs/SQL-BEFORE-AFTER.md)   | The old nested queries next to the Cypher            |
| [docs/BENCHMARKS.md](docs/BENCHMARKS.md)               | Every scenario: all queries, plans and timings       |
| [database/mysql/schema.sql](database/mysql/schema.sql) | The old MySQL tables                                 |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md)               | Collections, node labels, relationships, ownership   |

In the app: `/present` (agenda and timer), `/lab` (live comparisons), `/model` (before and after).

## What the measurements say

Medium dataset, one machine, one user at a time. Full table in `docs/BENCHMARKS.md`.

- **Neo4j wins deep traversals.** Shortest path (limit 5): 1.8 ms against 261 ms. Network at five
  hops: about 5 times faster. Also bought: about 3.5 times faster.
- **MySQL wins shallow and analytical queries.** One or two hops, small routes, monthly revenue.
- **MongoDB was not faster than MySQL in any read scenario.** It was 1.2 to 1.8 times slower on
  faceted search, the product page and attribute filtering, and 2 to 7 times slower on order
  history, analytics, trees and referrals. What it adds here is a simpler data shape, flexible
  attributes, atomic order documents, and transactions with change streams.
- **Indexes matter most:** about 40 times faster with the right index, in both MongoDB and MySQL.

## What you can show

| Page              | What it does for people                                                 | Database features behind it                        |
| ----------------- | ----------------------------------------------------------------------- | -------------------------------------------------- |
| For you           | suggestions that name who led to them                                   | graph traversal, collaborative similarity          |
| Browse, product   | filters that adapt to each category                                     | attribute pattern, `$facet`, `$bucket`, text index |
| Product           | who you know that bought it, and through whom                           | `FOLLOWS` 1..2 hops, paths                         |
| Checkout          | delivery routes and a safety warning before payment, live updates after | transaction, outbox, change stream                 |
| My orders         | prices as paid                                                          | embedded order snapshots                           |
| People            | suggestions, circle at 1..3 steps, how two people connect, referrals    | `SHORTEST`, variable length paths                  |
| Trust & safety    | fraud rings and referral loops                                          | shared node patterns, cycles                       |
| Delivery          | fastest, shortest, fewest stops                                         | weighted paths with `reduce()`                     |
| Store insights    | revenue and customers                                                   | aggregation pipelines, `$setWindowFields`          |
| Behind the scenes | 17 old-versus-new comparisons, data model, live sync                    | plans and result checks                            |

Each feature has a **How this works** button with the old approach, the new one and the real queries.

## Architecture

```
Nuxt pages -> server/api -> server/modules -> MongoDB  (documents, source of truth)
                                    |             | transaction: order + outbox event
                                    |             v change stream
                                    |         projector --MERGE--> Neo4j (relationships)
                                    +--------------------------------^
MySQL: the old model, used only by the performance lab
```

```
app/                 pages, components, composables
server/api/          HTTP routes: validate input, call a module
server/modules/      one folder per feature; lab/ holds the benchmark scenarios
server/infrastructure/  database clients, indexes, constraints
shared/              types and constants used by both sides
scripts/             database processes, seed, benchmark, example check
```

## Checks

```bash
bun test tests
bun run typecheck
bun run examples     # old SQL and new Cypher return the same ids
bun run format
```

## Good to know

- Orders, reviews and follows made in the app go to MongoDB and Neo4j only. The lab then reports
  "results differ" against MySQL. `bun run seed` resets all three.
- There is no login: the shopper picker in the sidebar chooses who you are.
