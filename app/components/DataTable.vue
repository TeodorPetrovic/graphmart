<script setup lang="ts" generic="Row extends object">
/**
 * A plain HTML table. Cells print `row[key]`; a slot named after the key replaces one cell.
 * Numbers go in `align: 'right'` columns so their digits line up.
 */
defineProps<{
  columns: { key: string; label: string; align?: 'right' }[]
  rows: Row[]
  rowKey?: (row: Row, index: number) => string | number
  empty?: string
}>()
defineSlots<Record<string, (props: { row: Row }) => unknown>>()
const cell = (row: Row, key: string) => (row as Record<string, unknown>)[key]
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-default text-muted">
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            class="py-2 pr-4 font-medium last:pr-0"
            :class="column.align === 'right' ? 'text-right' : 'text-left'"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-default">
        <tr v-for="(row, index) in rows" :key="rowKey ? rowKey(row, index) : index">
          <td
            v-for="column in columns"
            :key="column.key"
            class="py-2 pr-4 align-top last:pr-0"
            :class="column.align === 'right' ? 'text-right whitespace-nowrap tabular-nums' : ''"
          >
            <slot :name="column.key" :row="row">{{ cell(row, column.key) }}</slot>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!rows.length" class="py-4 text-sm text-muted">{{ empty ?? 'Nothing to show.' }}</p>
  </div>
</template>
