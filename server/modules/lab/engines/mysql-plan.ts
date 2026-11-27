import type { ExplainResponse } from '../../../../shared/types/api'

/** Operators that read rows from a table or index (as opposed to joining or sorting them). */
const ACCESS =
  /-> .*?(table scan|index scan|index lookup|index range scan|covering index [a-z ]+|single-row [a-z ]*index lookup|full-text)/i
const ACTUAL = /\(actual time=\S+ rows=([\d.e+]+) loops=([\d.e+]+)\)/i

/** Summarises the text tree produced by MySQL's `EXPLAIN ANALYZE`. */
export function parseMysqlPlan(plan: string): ExplainResponse['metrics'] {
  let rowsRead = 0
  const indexes = new Set<string>()
  const scans = new Set<string>()

  for (const line of plan.split('\n')) {
    if (!ACCESS.test(line)) continue
    const actual = ACTUAL.exec(line)
    // `rows` is the average per loop, so the total work is rows multiplied by loops.
    if (actual) rowsRead += Number(actual[1]) * Number(actual[2])
    const index = /on (\S+) using (\S+)/i.exec(line)
    if (index?.[2]) indexes.add(index[2])
    const scan = /table scan on (\S+)/i.exec(line)
    // `<temporary>` and `<derived>` scans read intermediate results, not stored tables.
    if (scan?.[1] && !scan[1].startsWith('<')) scans.add(scan[1])
  }

  return [
    { label: 'Rows read by access operators', value: Math.round(rowsRead).toLocaleString('en-US') },
    { label: 'Indexes used', value: [...indexes].join(', ') || 'none' },
    { label: 'Full table scans', value: [...scans].join(', ') || 'none' },
  ]
}
