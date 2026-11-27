# Database files

2,000 users, 1,000 products, 8,000 orders. The same data is in all three databases.

| Database | Files                                                      |
| -------- | ---------------------------------------------------------- |
| MongoDB  | `mongodb/graphmart.agz`                                    |
| Neo4j    | `neo4j/graphmart.cypher`                                   |
| MySQL    | `mysql/graphmart.sql`                                      |

## MongoDB (Studio 3T)

1. In Studio 3T open **Import**, choose **BSON - mongodump archive** and click **Configure**.
2. Pick `mongodb/graphmart.agz` and your connection, then run the import. It creates the
   `graphmart` database with its data, indexes and validators.

Studio 3T runs `mongorestore` for this. If it asks for it, install
[MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools) and set the path to
`mongorestore.exe` in **Preferences**, **External tools**, **MongoDB tools**.

The same file from a terminal: `mongorestore --gzip --archive=graphmart.agz`

## Neo4j (Neo4j Desktop)

Use a new, empty instance and start it. Open a terminal in the instance folder and run:

```powershell
bin\cypher-shell.bat -u neo4j -p YOUR_PASSWORD -f C:\path\to\database\neo4j\graphmart.cypher
```

The file is too large to paste into the query window.

## MySQL (Workbench)

Choose **Server**, **Data Import**, **Import from Self-Contained File**, pick
`mysql/graphmart.sql` and start the import. It creates the `graphmart` database.

To let the app connect with the user in `.env.example`, also run `mysql/create-database.sql` as
root.

## All three at once

With the databases set in `.env`, `bun run db:import` loads these files for you.

To write the files again from your databases: `bun run seed --scale small --replace`, then
`bun run db:export` (needs `mongodump` from the same tools).
