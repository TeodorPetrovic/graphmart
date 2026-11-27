# Class 1 (45 min): a shop that can sell anything, safely

MongoDB stores products with different attributes in one document and supports atomic writes. The
product page takes about 2 ms in MySQL and 3 ms in MongoDB in this benchmark.

## Before class

```bash
bun run db:up      # start the three databases
bun run seed       # medium dataset, about 4 minutes
bun run bench      # fills the comparison report, about 2 minutes
bun run build && bun run start     # http://localhost:3000
```

To reseed between classes, run `bun run seed --replace`. The default seed command refuses to
delete existing data. `bun run db:import --replace` loads a smaller committed dataset. The timings
in these notes were measured with the medium dataset from `bun run seed`.

Open Lecture plan (`/present`) for the agenda and timer. Click through the pages once. The
How this works button shows the approach and queries behind a feature.

| # | Min | Show |
|--:|--:|---|
| 1 | 5 | Meet the shop |
| 2 | 8 | Products and adaptive filters |
| 3 | 7 | Product page |
| 4 | 8 | Compare the product page and indexes |
| 5 | 10 | Buy something, live |
| 6 | 4 | Sales |
| 7 | 3 | Review |

Run the comparisons before placing an order. Orders update MongoDB and Neo4j, while the comparison
uses the seeded MySQL data.

---

## 1. Meet the shop (5 min)

- Open For you. Say: "This is the shop homepage. We will look at how its data is stored."
- Open Data model and expand `products`, `product_attributes`, `order_items`. "The old version
  needed eighteen tables. A laptop's memory size was a row in a generic attribute table."

## 2. Filters that adapt (8 min)

- Open Products, choose Laptops: attribute filters appear with counts. The filters use
  checkboxes and selects; price uses minimum and maximum inputs. Product results appear in a table.
- Tick two filters. Counts and results change together.
- Choose another category, such as Coffee Makers, and note which attribute filters appear.
- Ask: "To add a new attribute such as battery life, what would you change?" Old: a definition row,
  more joins, new filter queries. New: store the attribute on the product.
- Open How this works: the attribute pattern (`[{k, v}]`), an index for each attribute,
  `$facet` returning the page, total and all counts in one request.

## 3. One product, one page (7 min)

- Open product 1. Point out specifications, tags and the category trail: all in one document.
- Reviews are separate because they grow without limit. Rule: embed what is read together and
  stays small; reference what grows.
- Recommendations on For you use the graph. Class 2 looks at these paths in more detail.

## 4. Compare the product page and indexes (8 min)

Comparisons (`/lab/product-page`): show the SQL with three inner queries next to the
pipeline, press Run.

| | median | work done |
|---|--:|---|
| MySQL | about 2 ms | 29 rows read |
| MongoDB | about 3 ms | 7 documents examined |

The product page timings are close: about 2 ms in MySQL and 3 ms in MongoDB.

A true story from this project: the review lookup first examined 1,698 documents to return 5
reviews, because the index did not cover the tie breaker in the sort. One field added to the index
brought it to 7.

Comparisons (`/lab/index-impact`): run with `useIndex` 1, then 0, and press Explain.

| | with index | without |
|---|--:|--:|
| MySQL | about 1 ms | about 30 ms |
| MongoDB | about 2 ms | about 65 ms |

With this index, both databases run the query about 30 times faster.

## 5. Buy something, live (10 min)

1. In the sidebar, set Shopping as to user 7.
2. Add a product (not product 1) to the cart. Open Cart.
3. Select Check order. The account check and delivery table appear before placing the order.
   Leave Demo: use a card and device from a fraud ring unticked.
4. Select Place order. The result lists two updates: saved in MongoDB, then copied to Neo4j.
5. Open Orders: each order keeps the name and price paid, even if the product changes later.
6. Open Sync to see recent events and their delay.

Explain with How this works: the order updates stock and saves an event for the graph. A change
stream delivers the event. With MongoDB running as a single server, there are no transactions or
change streams; the live transaction demo needs a replica set. If Neo4j is down, orders still work
and events wait.

Optional: try to order more than is in stock. Nothing is half saved.

## 6. Sales (4 min)

- Open Sales: revenue, categories, customers.
- Open Comparisons and run `/lab/monthly-revenue`: MySQL about 90 ms, MongoDB about 260 ms.
- "Summing the whole history is where a relational database is very good. We keep one source of
  data. In this benchmark, MySQL is faster for this report."

## 7. Review (3 min)

Ask what changed in the product page query and how indexes affected each database.

---

## Questions you may get

Why was MongoDB not faster? One computer, one user, data that fits in memory, and MySQL is
excellent at joins on indexed keys. MongoDB can also be spread over many servers (sharding); this
project does not measure that, so do not claim it.

Is the comparison fair? Same data, indexes on both, similar memory, one database at a time, a
warm-up run, and the lab checks that all return identical rows. It does not test many users at once.

Isn't duplicated data bad? Order lines copy name and price on purpose: that is history. Review
author names are copies that would need updating after a rename.

Do you lose transactions? No. A single document is atomic, and multi document transactions are
used for orders and reviews.

If something breaks live: `docs/BENCHMARKS.md` holds every query and result.
