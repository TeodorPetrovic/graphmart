import { Tracer } from '../../infrastructure/trace'
import { reconcileProjections } from '../../modules/sync/reconcile.repository'

export default defineEventHandler(async () => {
  const tracer = new Tracer()
  const checks = await reconcileProjections(tracer)
  return { checks, trace: tracer.entries }
})
