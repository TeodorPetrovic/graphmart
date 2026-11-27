import { createError } from 'h3'
import { fraudUser } from '../../../modules/fraud/service'
import { intParam } from '../../../utils/http'
import { Tracer } from '../../../infrastructure/trace'
export default defineEventHandler(async (event) => {
  try {
    return await fraudUser(intParam(event, 'id'), new Tracer())
  } catch (e) {
    if (e instanceof Error && e.message === 'Unknown user')
      throw createError({ statusCode: 404, statusMessage: 'Unknown user' })
    throw e
  }
})
