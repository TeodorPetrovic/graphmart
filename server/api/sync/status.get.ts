import { Tracer } from '../../infrastructure/trace'
import { projectorState } from '../../modules/sync/projector'
import { outboxStatus } from '../../modules/sync/status'

export default defineEventHandler(async () => {
  const tracer = new Tracer()
  const status = await outboxStatus(tracer, projectorState())
  return { ...status, trace: tracer.entries }
})
