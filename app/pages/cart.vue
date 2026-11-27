<script setup lang="ts">
import type { CheckoutPreviewResponse, CreateOrderResponse, OrderView, SyncStatusResponse } from '#shared/types/api'
import { formatPrice } from '#shared/utils/demo'
import { useActiveUser } from '~/composables/useActiveUser'
import { useCart } from '~/composables/useCart'

const PAYMENTS = [
  { label: 'Card', value: 'card' },
  { label: 'PayPal', value: 'paypal' },
  { label: 'Cash on delivery', value: 'cash_on_delivery' },
]
const TRUST = {
  clear: { color: 'neutral', title: 'No shared payment or device details found' },
  review: { color: 'warning', title: 'One detail is shared with another account' },
  high: { color: 'error', title: 'Several accounts share these details' },
} as const

const cart = useCart()
const userId = useActiveUser()
const step = ref<'cart' | 'check' | 'done'>('cart')
const paymentMethod = ref<'card' | 'paypal' | 'cash_on_delivery'>('card')
const ownCard = (id: number) => `demo-card-${id.toString().padStart(4, '0')}`
const suspicious = ref(false)
const cardFingerprint = ref(ownCard(userId.value))
const deviceId = ref(`web-device-${userId.value}`)
const preview = ref<CheckoutPreviewResponse>()
const order = ref<OrderView>()
const processedAt = ref<string | null>(null)
const error = ref('')
const busy = ref(false)
const trust = computed(() => TRUST[preview.value?.trust.level ?? 'clear'])

watch([userId, suspicious], ([id, enabled]) => {
  cardFingerprint.value = enabled ? 'card-ring-shared' : ownCard(id)
  deviceId.value = enabled ? 'device-ring-01' : `web-device-${id}`
})

const checkoutBody = () => ({
  userId: userId.value,
  items: cart.lines.value.map(({ productId, quantity }) => ({ productId, quantity })),
  cardFingerprint: paymentMethod.value === 'card' ? cardFingerprint.value : null,
  deviceId: deviceId.value,
})
async function attempt(work: () => Promise<void>, fallback: string) {
  busy.value = true
  error.value = ''
  try {
    await work()
  } catch (cause) {
    error.value = apiErrorMessage(cause, fallback)
  } finally {
    busy.value = false
  }
}
const checkOrder = () =>
  attempt(async () => {
    preview.value = await $fetch<CheckoutPreviewResponse>('/api/checkout/preview', {
      method: 'POST',
      body: checkoutBody(),
    })
    step.value = 'check'
  }, 'Could not check the order.')
const placeOrder = () =>
  attempt(async () => {
    const result = await $fetch<CreateOrderResponse>('/api/orders', {
      method: 'POST',
      body: { ...checkoutBody(), paymentMethod: paymentMethod.value },
    })
    order.value = result.order
    processedAt.value = null
    cart.clear()
    step.value = 'done'
    void waitForGraph(result.eventId)
  }, 'Could not place the order. Check the stock and try again.')

/** Watches the outbox until the order has been copied to Neo4j. */
async function waitForGraph(eventId: string) {
  for (let tries = 0; tries < 20; tries += 1) {
    const status = await $fetch<SyncStatusResponse>('/api/sync/status').catch(() => null)
    if (!status) return
    processedAt.value = status.recent.find((item) => item.id === eventId)?.processedAt ?? null
    if (processedAt.value) return
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}
</script>

<template>
  <div class="space-y-8">
    <div v-if="step === 'cart'" class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <PageSection title="Items">
        <DataTable
          :rows="cart.lines.value"
          :columns="[
            { key: 'name', label: 'Product' },
            { key: 'priceCents', label: 'Each', align: 'right' },
            { key: 'quantity', label: 'Quantity', align: 'right' },
            { key: 'total', label: 'Total', align: 'right' },
          ]"
          :row-key="(line) => line.productId"
          empty="Your cart is empty."
        >
          <template #name="{ row }">
            <ULink :to="`/shop/${row.productId}`" class="font-medium text-default hover:underline">
              {{ row.name }}
            </ULink>
          </template>
          <template #priceCents="{ row }">{{ formatPrice(row.priceCents) }}</template>
          <template #quantity="{ row }">
            <UInput
              :model-value="row.quantity"
              type="number"
              min="0"
              max="99"
              class="w-20"
              :aria-label="`Quantity of ${row.name}`"
              @update:model-value="cart.setQuantity(row.productId, Number($event))"
            />
          </template>
          <template #total="{ row }">{{ formatPrice(row.priceCents * row.quantity) }}</template>
        </DataTable>
        <UButton v-if="!cart.lines.value.length" to="/shop" color="neutral" variant="outline">
          Browse products
        </UButton>
      </PageSection>
      <PageSection title="Payment">
        <UFormField label="Method">
          <USelect v-model="paymentMethod" :items="PAYMENTS" class="w-full" />
        </UFormField>
        <UFormField v-if="paymentMethod === 'card'" label="Card fingerprint">
          <UInput v-model="cardFingerprint" class="w-full" />
        </UFormField>
        <UFormField label="Device">
          <UInput v-model="deviceId" class="w-full" />
        </UFormField>
        <UCheckbox v-model="suspicious" label="Demo: use a card and device from a fraud ring" />
        <p class="flex justify-between border-t border-default pt-3 font-semibold">
          <span>Total</span><span class="tabular-nums">{{ formatPrice(cart.totalCents.value) }}</span>
        </p>
        <UAlert v-if="error" color="error" variant="subtle" :description="error" />
        <UButton block :loading="busy" :disabled="busy || !cart.lines.value.length" @click="checkOrder">
          Check order
        </UButton>
      </PageSection>
    </div>

    <template v-else-if="step === 'check' && preview">
      <PageSection title="Account check">
        <template #aside><InsightFeatureInsight feature="trust" :trace="preview.trace" /></template>
        <UAlert
          :color="trust.color"
          variant="subtle"
          :title="trust.title"
          :description="`Risk score ${preview.trust.score}. ${preview.trust.signals.map((s) => `${s.detail}.`).join(' ')}`"
        />
        <ul v-if="preview.trust.linkedAccounts.length" class="text-sm">
          <li v-for="account in preview.trust.linkedAccounts" :key="account.id">
            {{ account.name }} shares {{ account.via.join(' and ') }}
          </li>
        </ul>
      </PageSection>
      <PageSection title="Delivery">
        <template #aside><InsightFeatureInsight feature="delivery" :trace="preview.trace" /></template>
        <DataTable
          :rows="preview.delivery.shipments"
          :columns="[
            { key: 'productName', label: 'Product' },
            { key: 'route', label: 'Route' },
            { key: 'minutes', label: 'Minutes', align: 'right' },
          ]"
          :row-key="(shipment) => shipment.productId"
        >
          <template #route="{ row }">
            {{ row.route ? row.route.stops.map((stop) => stop.city).join(' → ') : 'No warehouse can ship this item' }}
          </template>
          <template #minutes="{ row }">{{ row.route?.durationMin }}</template>
        </DataTable>
      </PageSection>
      <PageSection title="Place the order">
        <template #aside><InsightFeatureInsight feature="checkout" :trace="preview.trace" /></template>
        <p class="text-xl font-semibold tabular-nums">{{ formatPrice(preview.totalCents) }}</p>
        <UAlert v-if="error" color="error" variant="subtle" :description="error" />
        <div class="flex gap-2">
          <UButton :loading="busy" @click="placeOrder">Place order</UButton>
          <UButton color="neutral" variant="outline" @click="step = 'cart'">Back to cart</UButton>
        </div>
      </PageSection>
    </template>

    <PageSection v-else-if="order" :title="`Order #${order.id} placed`">
      <p>{{ formatPrice(order.totalCents) }}</p>
      <ul class="text-sm">
        <li>Saved in MongoDB, stock updated.</li>
        <li role="status">
          {{
            processedAt
              ? `Copied to Neo4j at ${formatTimestamp(processedAt)}. Recommendations now include it.`
              : 'Waiting to be copied to Neo4j.'
          }}
        </li>
      </ul>
      <div class="flex gap-2">
        <UButton to="/orders">View orders</UButton>
        <UButton color="neutral" variant="outline" @click="step = 'cart'">Back to cart</UButton>
      </div>
    </PageSection>
  </div>
</template>
