<script setup lang="ts">
import schema from '~~/database/mysql/schema.sql?raw'

/** The real legacy DDL, so the page can never drift from the benchmarked tables. */
const tables = [...schema.matchAll(/CREATE TABLE (\w+) \([\s\S]*?\n\);/g)].map((match) => ({
  name: match[1]!,
  ddl: match[0],
  foreignKeys: match[0].match(/FOREIGN KEY/g)?.length ?? 0,
}))
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center gap-2">
      <EngineBadge engine="mysql" />
      <h2 class="text-2xl font-semibold">Before: {{ tables.length }} legacy tables</h2>
    </div>
    <p class="text-muted">
      A well indexed, normalised schema. Open a table to see its definition and the foreign keys a read has to join
      across.
    </p>
    <div class="grid items-start gap-2 lg:grid-cols-3">
      <details v-for="table in tables" :key="table.name" class="rounded-lg border border-default open:lg:col-span-3">
        <summary class="cursor-pointer px-3 py-2 font-mono text-sm">
          {{ table.name }}
          <span v-if="table.foreignKeys" class="text-muted">· {{ table.foreignKeys }} FK</span>
        </summary>
        <pre class="overflow-auto bg-neutral-950 px-4 py-3 text-sm text-neutral-100">{{ table.ddl }}</pre>
      </details>
    </div>
  </section>
</template>
