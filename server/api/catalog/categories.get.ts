import { Tracer } from '../../infrastructure/trace'
import { categoryTree } from '../../modules/catalog/catalog.repository'

export default defineEventHandler(async () => {
  const tracer = new Tracer()
  const tree = await categoryTree(tracer)
  return { tree, trace: tracer.entries }
})
