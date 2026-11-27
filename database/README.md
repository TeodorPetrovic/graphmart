# Database files

2,000 users, 1,000 products, 8,000 orders. The same data is in all three databases.

| Database | Files                                                      |
| -------- | ---------------------------------------------------------- |
| MongoDB  | `mongodb/setup.js`, then the eight `.json` files beside it |
| Neo4j    | `neo4j/graphmart.cypher`                                   |
| MySQL    | `mysql/graphmart.sql`                                      |

## MongoDB (Compass)

1. Open the shell at the bottom of Compass, paste all of `mongodb/setup.js` and press Enter. It
   creates the `graphmart` database, its collections and indexes.
2. For each `.json` file, open the collection with the same name in `graphmart`, choose
   **Add data**, then **Import JSON or CSV file**, and pick the file.

Do step 1 first: `product_views` has to be created as a time series collection.

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
`bun run db:export`.
