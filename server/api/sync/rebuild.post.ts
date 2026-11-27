import { Tracer } from '../../infrastructure/trace'
import { rebuildGraph } from '../../modules/sync/rebuild.service'

export default defineEventHandler(async () => {
  const tracer = new Tracer()
  return { ...(await rebuildGraph(tracer)), trace: tracer.entries }
})
