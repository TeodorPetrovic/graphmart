import { Tracer } from '../../infrastructure/trace'
import { databaseStats } from '../../modules/system/system.repository'

export default defineEventHandler(async () => {
  const tracer = new Tracer()
  const stats = await databaseStats(tracer)
  return { ...stats, trace: tracer.entries }
})
