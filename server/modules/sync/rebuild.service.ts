import type { Tracer } from '../../infrastructure/trace'
import { rebuildProjections } from './graph-loader'
import { withProjectionLock } from './projection-lock'

export async function rebuildGraph(tracer: Tracer) {
  const started = performance.now()
  const rebuilt = await withProjectionLock(() => rebuildProjections(tracer))
  return { rebuilt, ms: Math.round((performance.now() - started) * 100) / 100 }
}
