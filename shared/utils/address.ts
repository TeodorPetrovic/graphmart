/** Identity of a physical address across users; `(:Address {key})` in Neo4j. */
export function addressKey(address: { street: string; city: string; zip: string }): string {
  return `${address.street}|${address.city}|${address.zip}`.toLowerCase()
}
