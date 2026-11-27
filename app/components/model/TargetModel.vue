<script setup lang="ts">
import type { Graph, GraphNode } from '#shared/types/api'

const documents = [
  {
    title: 'products',
    code: `{
  _id: 1, name: "Aster Pro 14 Laptop", brand: "Aster", priceCents: 129900,
  categoryPath: [1, 2, 3],              // replaces a recursive join
  attributes: [{ k: "ram_gb", v: 16 },  // replaces the EAV tables
               { k: "color",  v: "black" }],
  tags: ["premium"],                    // replaces product_tags + tags
  ratingSummary: { avg: 4.2, count: 31, sum: 130 }
}`,
  },
  {
    title: 'orders',
    code: `{
  _id: 12, userId: 1, status: "paid",
  items: [{ productId: 1, name: "...", unitPriceCents: 129900, quantity: 1 }],
  shippingAddress: { street: "...", city: "...", zip: "..." },
  payment: { method: "card", cardFingerprint: "..." },
  deviceId: "..."
}`,
  },
]

/** The schema of the graph itself: one example node per label, placed by hand. */
const nodes: [kind: string, x: number, y: number][] = [
  ['User', 220, 200],
  ['Product', 560, 200],
  ['Category', 820, 200],
  ['Brand', 760, 340],
  ['Device', 40, 80],
  ['Card', 40, 210],
  ['Address', 60, 340],
  ['Warehouse', 560, 390],
]
const relationships: [source: string, type: string, target: string][] = [
  ['User', 'FOLLOWS', 'User'],
  ['User', 'REFERRED', 'User'],
  ['User', 'PURCHASED', 'Product'],
  ['User', 'VIEWED', 'Product'],
  ['User', 'RATED', 'Product'],
  ['User', 'USED_DEVICE', 'Device'],
  ['User', 'PAID_WITH', 'Card'],
  ['User', 'SHIPS_TO', 'Address'],
  ['Product', 'IN_CATEGORY', 'Category'],
  ['Category', 'SUBCATEGORY_OF', 'Category'],
  ['Product', 'MADE_BY', 'Brand'],
  ['Warehouse', 'STOCKS', 'Product'],
  ['Warehouse', 'ROUTE_TO', 'Warehouse'],
]
const graph: Graph = {
  nodes: nodes.map(([kind, x, y]): GraphNode => ({ id: kind, kind, label: kind, props: { x, y } })),
  edges: relationships.map(([source, type, target]) => ({ id: `${source}-${type}`, source, target, type })),
}

const ownership = [
  { fact: 'Users, products, categories, orders, reviews, views, warehouses', owner: 'MongoDB', copy: 'Neo4j' },
  { fact: 'FOLLOWS and ROUTE_TO relationships', owner: 'Neo4j', copy: 'none' },
]
const ownershipColumns = [
  { accessorKey: 'fact', header: 'Fact' },
  { accessorKey: 'owner', header: 'Written to' },
  { accessorKey: 'copy', header: 'Copied through the outbox to' },
]
</script>

<template>
  <div class="space-y-8">
    <section class="space-y-3">
      <h2 class="flex items-center gap-2 text-2xl font-semibold">
        <EngineBadge engine="mongo" /> After: documents shaped like the screens
      </h2>
      <div class="grid gap-4 xl:grid-cols-2">
        <UCard v-for="document in documents" :key="document.title">
          <template #header
            ><h3 class="font-mono font-semibold">{{ document.title }}</h3></template
          >
          <pre class="overflow-auto rounded-lg bg-neutral-950 p-4 text-sm text-neutral-100">{{ document.code }}</pre>
        </UCard>
      </div>
    </section>
    <section class="space-y-3">
      <h2 class="flex items-center gap-2 text-2xl font-semibold">
        <EngineBadge engine="neo4j" /> After: join tables become named relationships
      </h2>
      <GraphView :graph="graph" height="520px" />
    </section>
    <section class="space-y-3">
      <h2 class="text-2xl font-semibold">Each fact has exactly one owner</h2>
      <UTable :data="ownership" :columns="ownershipColumns" />
    </section>
  </div>
</template>
