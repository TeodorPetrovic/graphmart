# Class 2 (45 min): a shop that knows how people are connected

**Message:** the features today are about connections. The further a question walks, the more the
graph database wins. For one or two steps MySQL is just as good, and you should show that too.

Before class run `bun run seed` (class 1 added an order), then `bun run bench`, then
`bun run start`.

| # | Min | Show |
|--:|--:|---|
| 1 | 4 | Recommendations that explain themselves |
| 2 | 6 | Who do I know that bought this? |
| 3 | 10 | People and connections |
| 4 | 9 | Why this was impractical before |
| 5 | 9 | Catch a fraud ring, live |
| 6 | 4 | Plan a delivery |
| 7 | 3 | Better together |

Comparisons (4) come **before** the live fraud demo (5), which adds an order.

---

## 1. Recommendations that explain themselves (4 min)

- **For you** as user 1: "Bought by Noah, Elena, Mateo and 45 others in your network."
- Change the shopper: a different page.
- "A suggestion with a reason is more trusted, and the reason comes free: it is the path used to
  find the product."

## 2. Who do I know that bought this? (6 min)

- Product 1, **People you know who bought this**: names, and through whom you know them.
- Open **Show connections** for the drawing.
- **Often bought together**: product, its buyers, their other products. A popular product has many
  buyers, so this is the heaviest question on the page (about 100 ms in the graph, 360 ms in MySQL).

## 3. People and connections (10 min)

**People** page:

1. **Discover**: people you may know, with the mutual friends who explain each one. Follow someone.
2. **Your circle**: user 1 reaches about 45 people in one step, hundreds in two and thousands in
   three. "This growth is the whole problem."
3. **How are we connected?** Press **Try user 1 to user 50**: four steps, shown person by person.
4. **Referrals**: who you brought in, level by level.

A follow is saved only in the graph. Before pressing **Follow**, set **Discover from** to user 7,
so that the comparisons for user 1 still match MySQL.

## 4. Why this was impractical before (9 min)

**Data model**, "The inner queries the graph replaces": show the three level nested query next to
`FOLLOWS*1..3`.

`/lab/friends-network`, depth 1 to 5:

| Steps | MySQL | Neo4j |
|--:|--:|--:|
| 1 | 1 ms | 3 ms |
| 2 | 2 ms | 3 ms |
| 3 | 18 ms | 8 ms |
| 4 | 118 ms | 25 ms |
| 5 | 331 ms | 65 ms |

"MySQL wins at one step. Between two and three they cross."

`/lab/shortest-path`, maximum depth 3 to 6:

| Limit | MySQL | Neo4j |
|--:|--:|--:|
| 3 | 9 ms | 2 ms |
| 4 | 65 ms | 2 ms |
| 5 | 260 ms | 2 ms |
| 6 | 480 ms | 2 ms |

"MySQL builds every level up to the limit. The graph stops as soon as it finds the path."
At limit 5 MySQL read about 299,000 rows; Neo4j did 138 database hits.

`/lab/people-you-may-know`: MySQL about 1 ms, Neo4j about 6 ms. "Two cheap steps: SQL wins. And
how you write a graph query matters: our first version did 335,000 database hits, the rewrite does
18,000."

## 5. Catch a fraud ring, live (9 min)

1. Set **Shopping as** to user **9**. Add product 3 to the cart.
2. In **Cart**, tick **Demo: use a suspicious card**, then **Check delivery and safety**.
   A red warning names the accounts that already use this card and device.
3. Place the order anyway.
4. Open **Trust & safety**: the case now includes user 9. **Review case** and show the drawing and
   the reasons for the score (card 35, device 30, address 15, plus 10 for each account above two,
   up to 100).
5. Show the **referral loop**: four accounts that referred each other in a circle.

"A fraudster can invent a new name. The shared card still connects the accounts." Say that a score
is a reason to look, not proof.

## 6. Plan a delivery (4 min)

- **Delivery**: pick a product and destination. The shop picks a warehouse that has it.
- Compare fastest, shortest and fewest stops from warehouse Belgrade to Amsterdam.
- Honest note: with only 12 warehouses MySQL is faster (2 ms against 5 ms). The graph query is
  easier to read.

## 7. Better together (3 min)

**Live sync**, press **Reconcile**: both databases agree.

| Use | When |
|---|---|
| MongoDB | what things are: products, orders, whole objects |
| Neo4j | how things connect: several steps, paths, rings |
| Relational | strict shared rules, large set based reports, shallow joins |

"Two databases cost more to run and the graph is a moment behind. We pay that for features that
would be slow or unreadable otherwise."

---

## Questions you may get

**Why not only Neo4j?** Catalogue search with filters, nested flexible products and large reports
fit MongoDB better.

**What if Neo4j is down?** Browsing and ordering keep working, graph suggestions disappear, events
wait and are applied afterwards.

**How is it kept consistent?** The event is saved in the same transaction as the order; the graph
writes are repeatable without duplicates; Reconcile shows drift and Rebuild repairs it.

**What would you improve?** Precompute suggestions for very popular products, test with many users
at once, run several sync workers.
