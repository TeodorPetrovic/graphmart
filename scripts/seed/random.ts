export interface RandomSource {
  next(): number
}

export function createRandom(seed = 0x47524150): RandomSource {
  let state = seed >>> 0

  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0
      let value = state
      value = Math.imul(value ^ (value >>> 15), value | 1)
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296
    },
  }
}

export function pick<T>(random: RandomSource, values: readonly T[]): T {
  return values[Math.floor(random.next() * values.length)]!
}

export function dateBeforeAnchor(random: RandomSource, days = 730): Date {
  const anchor = Date.parse('2026-11-01T00:00:00.000Z')
  return new Date(anchor - Math.floor(random.next() * days * 86_400_000))
}

export function dateAfter(random: RandomSource, start: Date): Date {
  const end = Date.parse('2026-11-01T00:00:00.000Z')
  const availableDays = Math.max(1, Math.floor((end - start.getTime()) / 86_400_000))
  return new Date(start.getTime() + Math.floor(random.next() * availableDays * 86_400_000))
}
