import type { Address, UserDoc } from '../../shared/types/domain'
import { cities, firstNames, interests, lastNames } from './reference-data'
import { dateBeforeAnchor, pick, type RandomSource } from './random'

export interface UserData {
  users: UserDoc[]
  addresses: Map<number, Address[]>
}

const ringAddress: Address = {
  label: 'Home',
  street: '18 Market Street',
  city: 'Belgrade',
  zip: '11000',
}

export function generateUsers(count: number, random: RandomSource): UserData {
  const users: UserDoc[] = []
  const addresses = new Map<number, Address[]>()

  for (let id = 1; id <= count; id += 1) {
    const cityIndex = (id * 7 + Math.floor(random.next() * cities.length)) % cities.length
    const [city, country] = cities[cityIndex]!
    const first = firstNames[(id * 11 + Math.floor(random.next() * firstNames.length)) % firstNames.length]!
    const last = lastNames[(id * 13 + Math.floor(random.next() * lastNames.length)) % lastNames.length]!
    const home =
      id >= 101 && id <= 106
        ? ringAddress
        : {
            label: 'Home',
            street: `${10 + ((id * 17) % 980)} ${pick(random, ['Oak', 'River', 'Market', 'King', 'Garden', 'Station', 'Park', 'Church'])} ${pick(random, ['Street', 'Avenue', 'Road', 'Lane'])}`,
            city,
            zip: `${10000 + ((id * 37) % 89999)}`,
          }

    const user: UserDoc = {
      _id: id,
      name: `${first} ${last}`,
      email: `user${id}@graphmart.example`,
      city,
      country,
      tier: id === 1 || random.next() < 0.09 ? 'gold' : random.next() < 0.36 ? 'silver' : 'bronze',
      createdAt: dateBeforeAnchor(random, 1800),
      interests: chooseInterests(random),
      addresses: [
        home,
        {
          ...home,
          label: 'Work',
          street: `${20 + (id % 900)} ${pick(random, ['Central', 'Broadway', 'Union'])} Avenue`,
        },
      ],
      referredById: referrerFor(id, count, random),
    }
    users.push(user)
    addresses.set(id, user.addresses)
  }

  return { users, addresses }
}

function chooseInterests(random: RandomSource): string[] {
  const shuffled = [...interests].sort(() => random.next() - 0.5)
  return shuffled.slice(0, 3)
}

function referrerFor(id: number, count: number, random: RandomSource): number | null {
  if (id === 1) return null
  if (id >= 112 && id <= 114) return id - 1
  if (id === 111) return 114
  if (id <= 5) return id - 1
  if (id <= 120 && id > count) return null
  if (id <= 120) return random.next() < 0.4 ? Math.floor(random.next() * (id - 1)) + 1 : null
  return random.next() < 0.72 ? Math.floor(random.next() * (id - 1)) + 1 : null
}
