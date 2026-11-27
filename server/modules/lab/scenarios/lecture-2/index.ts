import type { Scenario } from '../../types'
import { friendsNetwork } from './friends-network'
import { peopleYouMayKnow } from './people-you-may-know'
import { alsoBought } from './also-bought'
import { socialRecommendations } from './social-recommendations'
import { shortestPath } from './shortest-path'
import { referralChain } from './referral-chain'
import { fraudRings } from './fraud-rings'
import { deliveryRoute } from './delivery-route'
import { polyglotRecommendation } from './polyglot-recommendation'

export const lectureTwo: Scenario[] = [
  friendsNetwork,
  peopleYouMayKnow,
  alsoBought,
  socialRecommendations,
  shortestPath,
  referralChain,
  fraudRings,
  deliveryRoute,
  polyglotRecommendation,
]
