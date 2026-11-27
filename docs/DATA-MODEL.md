# Data model contract

One dataset, three representations. Ids are integers and identical everywhere.

## Ownership (each fact has exactly one owner)

| Fact | Owner (writes) | Projected to |
|---|---|---|
| users, products, categories, orders, reviews, views, warehouses | MongoDB | Neo4j (through the outbox) |
| `FOLLOWS` | Neo4j | - |
| `ROUTE_TO` | Neo4j | - |

MySQL is the **legacy model**: used only by the performance lab, as the "before" picture.

## MongoDB (database `graphmart`)

`users`, `categories`, `products`, `orders`, `reviews`, `product_views` (time series),
`warehouses`, `outbox`, `counters`. Shapes: `shared/types/domain.ts`.

## Neo4j

Nodes (key property, unique constraint):

- `(:User {id, name, city, tier})`
- `(:Product {id, name, priceCents, brand})`
- `(:Category {id, name})`
- `(:Brand {name})`
- `(:Device {id})`
- `(:Card {fingerprint})`
- `(:Address {key})` where key = lower case `street|city|zip`
- `(:Warehouse {id, name, city, lat, lng})`

Relationships:

| Pattern | Properties | Idempotency key (MERGE) |
|---|---|---|
| `(:User)-[:FOLLOWS]->(:User)` | since: datetime | endpoints |
| `(:User)-[:REFERRED]->(:User)` | at: datetime | endpoints |
| `(:User)-[:PURCHASED]->(:Product)` | orderId, quantity, at: datetime | endpoints + orderId |
| `(:User)-[:VIEWED]->(:Product)` | count, lastAt: datetime | endpoints |
| `(:User)-[:RATED]->(:Product)` | rating, reviewId, at: datetime | endpoints + reviewId |
| `(:Product)-[:IN_CATEGORY]->(:Category)` | | endpoints (leaf category only) |
| `(:Category)-[:SUBCATEGORY_OF]->(:Category)` | | endpoints (child -> parent) |
| `(:Product)-[:MADE_BY]->(:Brand)` | | endpoints |
| `(:User)-[:USED_DEVICE]->(:Device)` | | endpoints |
| `(:User)-[:PAID_WITH]->(:Card)` | | endpoints |
| `(:User)-[:SHIPS_TO]->(:Address)` | | endpoints (order shipping addresses) |
| `(:Warehouse)-[:STOCKS]->(:Product)` | quantity | endpoints |
| `(:Warehouse)-[:ROUTE_TO]->(:Warehouse)` | distanceKm, durationMin | endpoints (directed; seed both directions) |

Cancelled orders are **not** projected: no `PURCHASED`, and their device, card and address
do not create `USED_DEVICE` / `PAID_WITH` / `SHIPS_TO`.

## Referrals

`users.referredById` (Mongo) / `users.referred_by_id` (MySQL) becomes
`(referrer)-[:REFERRED]->(referred)`. The planted cycle 111->112->113->114->111 means
112.referredById = 111, 113 = 112, 114 = 113 and 111.referredById = 114.
All referral traversals must therefore be cycle safe (especially recursive SQL).

## Views

`product_views` events are aggregated into one `VIEWED` relationship per (user, product).
MySQL keeps one row per event in `product_views`.
