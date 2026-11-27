# Class 2 (45 min): a shop that knows how people are connected

Today covers queries about connections. MySQL is fast for one or two steps in this dataset. Neo4j
is faster for some longer paths.

Before class, reseed with `bun run seed --replace` because class 1 added an order. The timings below
use the medium dataset from `bun run seed`; `bun run db:import --replace` loads a smaller dataset.
Then run `bun run bench` and `bun run start`.

| # | Min | Show |
|--:|--:|---|
| 1 | 4 | Recommendations that explain themselves |
| 2 | 6 | Who do I know that bought this? |
| 3 | 10 | People and connections |
| 4 | 9 | Why this was impractical before |
| 5 | 9 | Catch a fraud ring, live |
| 6 | 4 | Plan a delivery |
| 7 | 3 | Choosing databases by query |

Run comparisons before the fraud demo, which adds an order.

---

## 1. Recommendations that explain themselves (4 min)

- Open For you as user 1 and review the recommendations based on people they follow.
- Change the shopper and compare the recommendations.
- Each recommendation includes the path used to find the product.

## 2. Who do I know that bought this? (6 min)

- Open product 1 and review People you know who bought this: names and the person connecting
  you to each buyer.
- The Often bought together section shows a product, its buyers, and their other products. A popular product has many
  buyers, so this is the heaviest question on the page (about 100 ms in the graph, 360 ms in MySQL).

## 3. People and connections (10 min)

Open the People page:

1. Suggestions: people you may know, with the mutual friends shown in the table. Follow someone.
2. Network: user 1 reaches about 45 people in one step, hundreds in two, and thousands in
   three.
3. Connect two people: select user 1 and user 50 to see the four-step chain.
4. Referrals: who you brought in, level by level.

A follow is saved in the graph. Set the Shopping as control to user 7 before pressing Follow, so the
comparisons for user 1 still match MySQL.

## 4. Why this was impractical before (9 min)

Data model, "The inner queries the graph replaces": show the three-level nested query next to
`FOLLOWS*1..3`.

`/lab/friends-network`, depth 1 to 5:

| Steps | MySQL | Neo4j |
|--:|--:|--:|
| 1 | 1 ms | 3 ms |
| 2 | 2 ms | 3 ms |
| 3 | 18 ms | 8 ms |
| 4 | 118 ms | 25 ms |
| 5 | 331 ms | 65 ms |

MySQL is faster at one step in this run. Neo4j becomes faster between two and three steps.

`/lab/shortest-path`, maximum depth 3 to 6:

| Limit | MySQL | Neo4j |
|--:|--:|--:|
| 3 | 9 ms | 2 ms |
| 4 | 65 ms | 2 ms |
| 5 | 260 ms | 2 ms |
| 6 | 480 ms | 2 ms |

MySQL builds every level up to the limit. Neo4j stops after it finds the path.
At limit 5 MySQL read about 299,000 rows; Neo4j did 138 database hits.

`/lab/people-you-may-know`: MySQL about 1 ms, Neo4j about 6 ms. This two-step query is faster in
MySQL. The first graph query used 335,000 database hits; the revised query uses 18,000.

## 5. Catch a fraud ring, live (9 min)

1. Set Shopping as to user 9. Open product 3 and add it to the cart.
2. In Cart, tick Demo: use a card and device from a fraud ring, then select Check order.
   The account check shows linked accounts that share the card and device.
3. Select Place order.
4. Open Fraud review: review the group that includes user 9 and show the graph and
   the reasons for the score (card 35, device 30, address 15, plus 10 for each account above two,
   up to 100).
5. Show the referral loop: four accounts that referred each other in a circle.

An account can use a new name and still share a card with other accounts. A score can prompt a
review, but it does not prove fraud.

## 6. Plan a delivery (4 min)

- Delivery: pick a product and destination. The shop picks a warehouse that has it.
- Compare fastest, shortest and fewest stops from warehouse Belgrade to Amsterdam.
- With 12 warehouses, MySQL is faster (2 ms compared with 5 ms). The graph query is easier to read.

## 7. Choosing databases by query (3 min)

Sync, press Compare counts to check whether both databases agree.

| Use | When |
|---|---|
| MongoDB | what things are: products, orders, whole objects |
| Neo4j | how things connect: several steps, paths, rings |
| Relational | strict shared rules, large set based reports, shallow joins |

Two databases cost more to run, and Neo4j can be behind MongoDB briefly. Neo4j supports queries that
take more work to express or run in relational SQL.

---

## Questions you may get

Why use MongoDB as well as Neo4j? Catalogue search with filters, nested flexible products and
large reports fit MongoDB well.

What if Neo4j is down? Browsing and ordering keep working, graph suggestions disappear, events
wait and are applied afterwards.

How is it kept consistent? The event is saved in the same transaction as the order; the graph
writes are repeatable without duplicates; Reconcile shows drift and Rebuild repairs it.

What would you improve? Precompute suggestions for very popular products, test with many users
at once, run several sync workers.
