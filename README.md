<img src="assets/icon.svg" width="64" height="64" alt="">

# GraphMart

An online shop for a non-relational databases course. MongoDB holds products and orders, Neo4j holds
how people, purchases, cards and warehouses are connected, and MySQL holds the old table version for
comparison. Built with Nuxt 4, Nuxt UI and Bun.

## Set up on Windows

You need [Bun](https://bun.sh), MongoDB 8, Neo4j (Neo4j Desktop is fine) and MySQL 8. MySQL is only
used by the comparisons.

1. In Neo4j Desktop, create a new instance for this project and start it. Loading the data replaces
   everything in that database.
2. In MySQL Workbench, open and run `database/mysql/create-database.sql` as root.
3. In a terminal:

```powershell
git clone https://github.com/TeodorPetrovic/graphmart.git
cd graphmart
bun install
copy .env.example .env      # then set your MongoDB address and Neo4j password in .env
bun run db:check            # says which database it cannot reach, and why
bun run db:import           # loads the files in database/, up to 2 minutes
bun run build
bun run start               # http://localhost:3000
```

If your MongoDB asks for a login, put it in `.env`:
`MONGO_URI=mongodb://USER:PASSWORD@127.0.0.1:27017/?authSource=admin&directConnection=true`

`db:import` and `seed` stop without changing anything when a database already holds data. Add
`--replace` to delete it and load again. Add `--only neo4j` (or `mongo`, `mysql`) for one database.

## Data

|               | `bun run db:import`             | `bun run seed`          |
| ------------- | ------------------------------- | ----------------------- |
| Source        | files in [database/](database/) | generated while loading |
| Users, orders | 2,000 and 8,000                 | 20,000 and 100,000      |
| Use it for    | showing the app                 | the performance classes |

`bun run bench` measures all 17 comparisons on whatever is loaded and writes
[docs/BENCHMARKS.md](docs/BENCHMARKS.md). The [database folder](database/README.md) explains how to
load the files by hand with Studio 3T, Workbench and Neo4j Desktop.

## Transactions need a replica set

A MongoDB installed as a Windows service usually runs as a single server. The app works that way, but
it saves an order step by step (reversing the steps if one fails) and checks for new events every
second. To show real transactions and change streams, turn the server into a one-member replica set.
These steps change your MongoDB service and have not been tried on this machine.

1. Add to `C:\Program Files\MongoDB\Server\8.2\bin\mongod.cfg`:

```yaml
replication:
  replSetName: rs0
```

If the file has `authorization: enabled`, MongoDB also needs a key file. Put a long random line of
letters and digits in a file, and add `keyFile: C:\path\to\that\file` under `security:`.

2. Restart the service from an administrator PowerShell: `Restart-Service MongoDB`
3. In the Compass shell, signed in as an administrator:
   `rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] })`
4. Restart the app. The Sync page then says "Change stream".

## Separate database copies (optional)

To keep your installed servers untouched, the project can run its own copies on other ports. This
needs the MongoDB and MySQL programs installed, Java 21, and the Neo4j Community zip unpacked into
`.tools/`.

```powershell
copy .env.private.example .env
bun run db:setup     # once
bun run db:up        # after every reboot; bun run db:down stops them
bun run db:import
```

## Pages

| Page         | What it does                                    | Database features                 |
| ------------ | ----------------------------------------------- | --------------------------------- |
| For you      | suggests products and names who led to them     | traversal, similarity             |
| Products     | filters that follow the products found          | attribute pattern, `$facet`       |
| Product page | shows who you know that bought it               | `FOLLOWS` 1..2 steps              |
| Cart         | checks shared cards and plans delivery          | transaction or step-by-step save  |
| Orders       | keeps the price paid                            | embedded order items              |
| People       | suggestions, network, shortest chain, referrals | `SHORTEST`, variable length paths |
| Fraud review | accounts sharing cards, devices or addresses    | shared nodes, cycles              |
| Delivery     | fastest, shortest and fewest-stop routes        | weighted paths                    |
| Sales        | revenue and customers                           | aggregation pipelines             |
| Comparisons  | 17 questions answered by each database          | query plans, result checks        |

**How this works** beside a feature shows the old approach, the new one and the queries that ran.
For the classes, see [class 1](docs/LECTURE-1.md), [class 2](docs/LECTURE-2.md),
[old and new queries](docs/SQL-BEFORE-AFTER.md) and the [data model](docs/DATA-MODEL.md).

## What the measurements show

Medium dataset, one computer, one user at a time.

- Neo4j is much faster for deep connections: a shortest path of up to five steps took 1.8 ms against
  261 ms in MySQL.
- MySQL is faster for one or two steps, small route networks and large reports.
- MongoDB was not faster than MySQL for any read. Its gains here are flexible product fields, one
  document per order, transactions and change streams.
- The right index made both MySQL and MongoDB about 40 times faster.

## Layout and checks

```
app/           pages and components (interface rules: docs/UI-RULES.md)
server/        API routes, feature modules, database clients
shared/        types used by both
scripts/       check, import, export, seed, benchmark
database/      importable data for all three databases
```

```powershell
bun test tests
bun run typecheck
bun run examples     # old SQL and new Cypher return the same ids
bun run format
```

There is no login. "Shopping as" in the sidebar chooses the user.
