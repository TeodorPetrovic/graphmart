# Class 1 (45 min): a shop that can sell anything, safely

**Message:** students should see features first, then learn why the database makes them natural.
MongoDB's gain here is **flexible data and safe writes**, not read speed. Say that openly.

## Before class

```bash
bun run db:up      # start the three databases
bun run seed       # clean data, about 4 minutes
bun run bench      # fills the comparison report, about 2 minutes
bun run build && bun run start     # http://localhost:3000
```

Open **Lecture guide** (`/present`) for the agenda and timer. Click through each page once so
everything is warm. In each feature, the **How this works** button shows the old approach, the new
one and the real queries. Open it only when you want to talk about it.

| # | Min | Show |
|--:|--:|---|
| 1 | 5 | Meet the shop |
| 2 | 8 | Browse and adaptive filters |
| 3 | 7 | Product page |
| 4 | 8 | Old against new |
| 5 | 10 | Buy something, live |
| 6 | 4 | Store insights |
| 7 | 3 | Wrap up |

Keep this order: the comparisons come **before** the purchase, because a purchase is written to
MongoDB and Neo4j only, and MySQL would no longer match.

---

## 1. Meet the shop (5 min)

- Open **For you**. "This looks like any shop. Today we look at what makes parts of it easy."
- Open **Data model** and expand `products`, `product_attributes`, `order_items`. "The old version
  needed eighteen tables. A laptop's memory size was a row in a generic attribute table."

## 2. Filters that adapt (8 min)

- **Browse**, choose **Laptops**: memory, storage, colour, Wi-Fi filters appear with counts.
- Tick two filters. Counts and results change together.
- Choose another category (for example Coffee Makers): **different filters, same screen**.
- Ask: "To add a new attribute such as battery life, what would you change?" Old: a definition row,
  more joins, new filter queries. New: store the attribute on the product.
- Open **How this works**: the attribute pattern (`[{k, v}]`), one index for every attribute,
  `$facet` returning the page, total and all counts in one request.

## 3. One product, one page (7 min)

- Open product 1. Point out specifications, tags and the category trail: all in one document.
- Reviews are **separate** because they grow without limit. Rule: embed what is read together and
  stays small; reference what grows.
- "Often bought together" and "People you know" come from the other database. Leave them for class 2.

## 4. Old against new, honestly (8 min)

**Product page** comparison (`/lab/product-page`): show the SQL with three inner queries next to the
pipeline, press **Run**.

| | median | work done |
|---|--:|---|
| MySQL | about 2 ms | 29 rows read |
| MongoDB | about 3 ms | 7 documents examined |

"Same speed. What changed is how simple the read is."

A true story from this project: the review lookup first examined **1,698 documents** to return 5
reviews, because the index did not cover the tie breaker in the sort. One field added to the index
brought it to **7**.

**Indexes** (`/lab/index-impact`): run with `useIndex` 1, then 0, and press **Explain**.

| | with index | without |
|---|--:|--:|
| MySQL | about 1 ms | about 30 ms |
| MongoDB | about 2 ms | about 65 ms |

"The right index is worth about 40 times, in **both** databases."

## 5. Buy something, live (10 min)

1. In the sidebar, set **Shopping as** to user **7**.
2. Add a product (not product 1) to the cart. Open **Cart**.
3. **Check delivery and safety**: a delivery route per parcel and a safety result appear *before*
   paying. Do not tick the suspicious card today.
4. **Place order**. Watch the timeline: saved, delivered, recommendations updated.
5. Open **My orders**: the order keeps the name and price paid, even if the product changes later.
6. Open **Live sync**: the event and how many milliseconds it took.

Explain with **How this works**: one transaction decrements stock, saves the order and saves an
event. A change stream delivers the event to the graph. If that database is down, orders still work
and events wait.

Optional: try to order more than is in stock. Nothing is half saved.

## 6. Store insights (4 min)

- Open **Store insights**: revenue, categories, customers.
- Run `/lab/monthly-revenue`: MySQL about 90 ms, MongoDB about 260 ms.
- "Summing the whole history is where a relational database is very good. We keep one source of
  data; we do not claim speed."

## 7. Wrap up (3 min)

"We gained products with any shape, screens that read one object, and orders that never half
happen. Next class: questions about **who is connected to whom**."

---

## Questions you may get

**Why was MongoDB not faster?** One computer, one user, data that fits in memory, and MySQL is
excellent at joins on indexed keys. MongoDB can also be spread over many servers (sharding); this
project does not measure that, so do not claim it.

**Is the comparison fair?** Same data, indexes on both, similar memory, one database at a time, a
warm-up run, and the lab checks that all return identical rows. It does not test many users at once.

**Isn't duplicated data bad?** Order lines copy name and price on purpose: that is history. Review
author names are copies that would need updating after a rename.

**Do you lose transactions?** No. A single document is atomic, and multi document transactions are
used for orders and reviews.

**If something breaks live:** `docs/BENCHMARKS.md` holds every query and result.
