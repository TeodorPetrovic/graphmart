export interface FraudLink {
  left: number
  right: number
  device: string | null
  card: string | null
  address: string | null
}

export interface FraudComponent {
  userIds: number[]
  devices: Set<string>
  cards: Set<string>
  addresses: Set<string>
}

/** Connected components are built from direct shared-identity pairs, independent of row order. */
export function groupFraudLinks(links: FraudLink[], minUsers: number): FraudComponent[] {
  const parents = new Map<number, number>()

  const find = (id: number): number => {
    const parent = parents.get(id)
    if (parent === undefined || parent === id) return id
    const root = find(parent)
    parents.set(id, root)
    return root
  }

  for (const link of links) {
    parents.set(link.left, link.left)
    parents.set(link.right, link.right)
  }

  for (const link of links) {
    const leftRoot = find(link.left)
    const rightRoot = find(link.right)
    if (leftRoot !== rightRoot) {
      parents.set(Math.max(leftRoot, rightRoot), Math.min(leftRoot, rightRoot))
    }
  }

  const components = new Map<number, FraudComponent>()
  for (const link of links) {
    const root = find(link.left)
    const component = components.get(root) ?? {
      userIds: [],
      devices: new Set<string>(),
      cards: new Set<string>(),
      addresses: new Set<string>(),
    }
    component.userIds.push(link.left, link.right)
    if (link.device) component.devices.add(link.device)
    if (link.card) component.cards.add(link.card)
    if (link.address) component.addresses.add(link.address)
    components.set(root, component)
  }

  return [...components.values()]
    .map((component) => ({ ...component, userIds: [...new Set(component.userIds)].sort((a, b) => a - b) }))
    .filter(
      (component) => component.userIds.length >= minUsers && (component.devices.size > 0 || component.cards.size > 0),
    )
    .sort((left, right) => left.userIds[0]! - right.userIds[0]!)
}

/** Card and device signals carry more weight; address overlap is supporting evidence. */
export function fraudRisk(users: number, devices: number, cards: number, addresses: number): number {
  return Math.min(
    100,
    (cards > 0 ? 35 : 0) + (devices > 0 ? 30 : 0) + (addresses > 0 ? 15 : 0) + Math.max(0, users - 2) * 10,
  )
}
