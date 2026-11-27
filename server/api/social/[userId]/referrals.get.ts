import { referrals } from '../../../modules/social/service'
import { intParam } from '../../../utils/http'
import { Tracer } from '../../../infrastructure/trace'
export default defineEventHandler((event) => referrals(intParam(event, 'userId'), new Tracer()))
