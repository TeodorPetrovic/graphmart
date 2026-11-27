import { network } from '../../modules/logistics/service'
import { Tracer } from '../../infrastructure/trace'
export default defineEventHandler(() => network(new Tracer()))
