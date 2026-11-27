import { referralCycles } from '../../modules/fraud/service'
import { Tracer } from '../../infrastructure/trace'
export default defineEventHandler(() => referralCycles(new Tracer()))
