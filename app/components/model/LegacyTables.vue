<script setup lang="ts">
import schema from '~~/database/mysql/schema.sql?raw'

/** Read from the real schema file, so the page matches the tables used in the comparisons. */
const tables = [...schema.matchAll(/CREATE TABLE (\w+) \([\s\S]*?\n\);/g)].map((match) => ({
  name: match[1]!,
  ddl: match[0],
  foreignKeys: match[0].match(/FOREIGN KEY/g)?.length ?? 0,
}))
</script>

<template>
  <PageSection :title="`MySQL: ${tables.length} tables`" note="Open a table to read its definition.">
    <ul class="divide-y divide-default border-y border-default text-sm">
      <li v-for="table in tables" :key="table.name">
        <details>
          <summary class="flex cursor-pointer justify-between gap-3 py-1.5">
            <span class="font-mono">{{ table.name }}</span>
            <span v-if="table.foreignKeys" class="text-muted">
              {{ table.foreignKeys }} foreign {{ table.foreignKeys === 1 ? 'key' : 'keys' }}
            </span>
          </summary>
          <CodeBlock class="mb-2" :code="table.ddl" />
        </details>
      </li>
    </ul>
  </PageSection>
</template>
