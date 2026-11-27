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
  { key: 'fact', label: 'Data' },
  { key: 'owner', label: 'Written to' },
  { key: 'copy', label: 'Copied to' },
]
</script>

<template>
  <div class="space-y-8">
    <PageSection title="MongoDB: one document per product and per order">
      <div class="grid gap-4 xl:grid-cols-2">
        <div v-for="document in documents" :key="document.title" class="space-y-1">
          <h3 class="font-mono text-sm">{{ document.title }}</h3>
          <CodeBlock :code="document.code" />
        </div>
      </div>
    </PageSection>
    <PageSection title="Neo4j: join tables become named relationships">
      <GraphView :graph="graph" height="520px" />
    </PageSection>
    <PageSection title="Where each fact is written">
      <DataTable :rows="ownership" :columns="ownershipColumns" />
    </PageSection>
  </div>
</template>
