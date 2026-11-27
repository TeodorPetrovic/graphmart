import type { ExplainResponse } from '../../../../shared/types/api'

interface Totals {
  documents: number
  keys: number
  indexes: Set<string>
  collectionScan: boolean
}

const asNumber = (value: unknown) => (typeof value === 'number' ? value : Number(value ?? 0))

/**
 * Explain output differs between the classic and slot based engines and between pipeline
 * shapes, so this walks the whole tree: the `executionStats` of the initial cursor plus the
 * counters that `$lookup` / `$graphLookup` stages report about their own collection reads.
 */
function walk(node: unknown, totals: Totals, underRejectedPlan = false): void {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, totals, underRejectedPlan)
    return
  }
  if (!node || typeof node !== 'object') return
  const record = node as Record<string, unknown>

  const stats = record.executionStats as Record<string, unknown> | undefined
  if (stats) {
    totals.documents += asNumber(stats.totalDocsExamined)
    totals.keys += asNumber(stats.totalKeysExamined)
  }
  if ('$lookup' in record || '$graphLookup' in record) {
    totals.documents += asNumber(record.totalDocsExamined)
    totals.keys += asNumber(record.totalKeysExamined)
    for (const name of (record.indexesUsed as string[] | undefined) ?? []) totals.indexes.add(name)
  }
  if (!underRejectedPlan) {
    if (typeof record.indexName === 'string') totals.indexes.add(record.indexName)
    if (record.stage === 'COLLSCAN') totals.collectionScan = true
  }
  for (const [key, child] of Object.entries(record)) {
    walk(child, totals, underRejectedPlan || key === 'rejectedPlans' || key === 'allPlansExecution')
  }
}

export function parseMongoPlan(explanation: unknown): ExplainResponse['metrics'] {
  const totals: Totals = { documents: 0, keys: 0, indexes: new Set(), collectionScan: false }
  walk(explanation, totals)
  return [
    { label: 'Documents examined', value: totals.documents.toLocaleString('en-US') },
    { label: 'Index keys examined', value: totals.keys.toLocaleString('en-US') },
    { label: 'Indexes used', value: [...totals.indexes].join(', ') || 'none' },
    { label: 'Collection scan', value: totals.collectionScan ? 'yes' : 'no' },
  ]
}
