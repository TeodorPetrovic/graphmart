import { Tracer } from '../../infrastructure/trace'
import { analyticsDashboard } from '../../modules/analytics/analytics.repository'

export default defineEventHandler(async () => {
  const tracer = new Tracer()
  return { ...(await analyticsDashboard(tracer)), trace: tracer.entries }
})
