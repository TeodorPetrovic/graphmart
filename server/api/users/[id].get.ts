import { Tracer } from '../../infrastructure/trace'
import { getUser, userSocialCounts } from '../../modules/users/users.repository'
import { intParam, notFound } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const id = intParam(event, 'id')
  const tracer = new Tracer()
  const user = await getUser(id, tracer)
  if (!user) throw notFound('User not found')
  const social = await userSocialCounts(id, tracer)
  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      city: user.city,
      tier: user.tier,
      country: user.country,
      createdAt: user.createdAt.toISOString(),
      interests: user.interests,
      addresses: user.addresses,
      referredById: user.referredById,
    },
    social,
    trace: tracer.entries,
  }
})
