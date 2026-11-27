interface CartLine {
  productId: number
  name: string
  priceCents: number
  quantity: number
}

/** Cookie-backed state is shared by SSR and the browser without touching window during render. */
export function useCart() {
  const lines = useCookie<CartLine[]>('graphmart-cart', { default: () => [], sameSite: 'lax' })
  const count = computed(() => lines.value.reduce((sum, line) => sum + line.quantity, 0))
  const totalCents = computed(() => lines.value.reduce((sum, line) => sum + line.priceCents * line.quantity, 0))
  function add(product: { id: number; name: string; priceCents: number }) {
    const found = lines.value.find((line) => line.productId === product.id)
    if (found) found.quantity += 1
    else lines.value.push({ productId: product.id, name: product.name, priceCents: product.priceCents, quantity: 1 })
  }
  function setQuantity(productId: number, quantity: number) {
    if (quantity <= 0) lines.value = lines.value.filter((line) => line.productId !== productId)
    else
      lines.value = lines.value.map((line) =>
        line.productId === productId ? { ...line, quantity: Math.min(quantity, 99) } : line,
      )
  }
  function clear() {
    lines.value = []
  }
  return { lines, count, totalCents, add, setQuantity, clear }
}
