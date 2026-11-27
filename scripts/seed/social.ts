import type { Follow, UserDoc } from '../../shared/types/domain'
import { dateBeforeAnchor, type RandomSource } from './random'

export function generateFollows(users: UserDoc[], average: number, random: RandomSource): Follow[] {
  const userCount = users.length
  const ranking = Array.from({ length: userCount }, (_, index) => index + 1)
  shuffle(ranking, random)
  const usersByInterest = groupUsersByInterest(users)
  const pairs = new Map<string, Follow>()
  const protectedUsers = new Set([2, 3, 4, 50])

  for (let followerId = 1; followerId <= userCount; followerId += 1) {
    if (protectedUsers.has(followerId)) continue
    const target = Math.max(1, Math.round(average * (0.65 + random.next() * 0.7)))
    const selected = new Set<number>()
    while (selected.size < target) {
      const roll = random.next()
      const followeeId =
        roll < 0.3
          ? chooseSharedInterest(users[followerId - 1]!, usersByInterest, random)
          : roll < 0.7
            ? choosePopular(ranking, userCount, random)
            : 1 + Math.floor(random.next() * userCount)
      if (followeeId !== followerId && !protectedUsers.has(followeeId)) {
        selected.add(followeeId)
      }
    }
    for (const followeeId of selected) addFollow(pairs, followerId, followeeId, random)
  }

  // Demo user follows a broad set so its first two hops expose a useful network.
  const firstHops = shuffle(
    Array.from({ length: userCount }, (_, index) => index + 1).filter((id) => id !== 1 && !protectedUsers.has(id)),
    random,
  ).slice(0, 30)
  for (const followeeId of firstHops) addFollow(pairs, 1, followeeId, random)

  // A one-way planted chain fixes the demo target's shortest directed distance at four.
  addFollow(pairs, 1, 2, random)
  addFollow(pairs, 2, 3, random)
  addFollow(pairs, 3, 4, random)
  addFollow(pairs, 4, 50, random)

  // These incoming edges make the demo account's neighborhood show both directions.
  for (let followerId = 36; followerId <= 70; followerId += 1) {
    if (followerId <= userCount) addFollow(pairs, followerId, 1, random)
  }

  return [...pairs.values()]
}

function groupUsersByInterest(users: UserDoc[]): Map<string, number[]> {
  const grouped = new Map<string, number[]>()
  for (const user of users) {
    for (const interest of user.interests) {
      const members = grouped.get(interest) ?? []
      members.push(user._id)
      grouped.set(interest, members)
    }
  }
  return grouped
}

function chooseSharedInterest(user: UserDoc, usersByInterest: Map<string, number[]>, random: RandomSource): number {
  const interest = user.interests[Math.floor(random.next() * user.interests.length)]!
  const candidates = usersByInterest.get(interest) ?? []
  return candidates[Math.floor(random.next() * candidates.length)] ?? user._id
}

function choosePopular(ranking: number[], userCount: number, random: RandomSource): number {
  const rank = Math.floor(Math.pow(random.next(), 2.2) * userCount)
  return ranking[rank] ?? 1
}

function addFollow(pairs: Map<string, Follow>, followerId: number, followeeId: number, random: RandomSource): void {
  if (followerId === followeeId) return
  pairs.set(`${followerId}:${followeeId}`, {
    followerId,
    followeeId,
    since: dateBeforeAnchor(random),
  })
}

function shuffle<T>(values: T[], random: RandomSource): T[] {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random.next() * (index + 1))
    const current = values[index]!
    values[index] = values[swapIndex]!
    values[swapIndex] = current
  }
  return values
}
