<script setup lang="ts">
import type { CheckoutPreviewResponse, CreateOrderResponse, OrderView, SyncStatusResponse } from '#shared/types/api'
import { formatPrice } from '#shared/utils/demo'
import { useActiveUser } from '~/composables/useActiveUser'
import { useCart } from '~/composables/useCart'

const cart = useCart()
const userId = useActiveUser()
const step = ref(0)
const paymentMethod = ref<'card' | 'paypal' | 'cash_on_delivery'>('card')
const cardFingerprint = ref(`demo-card-${userId.value.toString().padStart(4, '0')}`)
const deviceId = ref(`web-device-${userId.value}`)
const suspicious = ref(false)
const preview = ref<CheckoutPreviewResponse>()
const order = ref<OrderView>()
const eventId = ref('')
const processedAt = ref<string | null>(null)
const error = ref('')
const busy = ref(false)
const steps = [
  { title: 'Cart', description: 'Review items', icon: 'i-lucide-shopping-bag' },
  { title: 'Delivery and safety', description: 'Check your parcel', icon: 'i-lucide-shield-check' },
  { title: 'Confirmed', description: 'Order placed', icon: 'i-lucide-check' },
]
const trustColor = computed(
  () => (({ clear: 'success', review: 'warning', high: 'error' }) as const)[preview.value?.trust.level ?? 'clear'],
)
watch(userId, (id) => {
  if (!suspicious.value) {
    cardFingerprint.value = `demo-card-${id.toString().padStart(4, '0')}`
    deviceId.value = `web-device-${id}`
  }
})
watch(suspicious, (enabled) => {
  cardFingerprint.value = enabled ? 'card-ring-shared' : `demo-card-${userId.value.toString().padStart(4, '0')}`
  deviceId.value = enabled ? 'device-ring-01' : `web-device-${userId.value}`
})
function updateQuantity(productId: number, quantity: number) {
  cart.setQuantity(productId, quantity)
}
async function prepareCheckout() {
  busy.value = true
  error.value = ''
  try {
    preview.value = await $fetch<CheckoutPreviewResponse>('/api/checkout/preview', {
      method: 'POST',
      body: {
        userId: userId.value,
        items: cart.lines.value.map(({ productId, quantity }) => ({ productId, quantity })),
        cardFingerprint: paymentMethod.value === 'card' ? cardFingerprint.value : null,
        deviceId: deviceId.value,
      },
    })
    step.value = 1
  } catch (cause) {
    error.value = apiErrorMessage(cause, 'Could not check delivery and account safety.')
  } finally {
    busy.value = false
  }
}
async function placeOrder() {
  busy.value = true
  error.value = ''
  try {
    const result = await $fetch<CreateOrderResponse>('/api/orders', {
      method: 'POST',
      body: {
        userId: userId.value,
        items: cart.lines.value.map(({ productId, quantity }) => ({ productId, quantity })),
        paymentMethod: paymentMethod.value,
        cardFingerprint: paymentMethod.value === 'card' ? cardFingerprint.value : null,
        deviceId: deviceId.value,
      },
    })
    order.value = result.order
    eventId.value = result.eventId
    cart.clear()
    step.value = 2
    void pollSync(result.eventId)
  } catch (cause) {
    error.value = apiErrorMessage(cause, 'Checkout failed. Check stock and try again.')
  } finally {
    busy.value = false
  }
}
async function pollSync(id: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const status = await $fetch<SyncStatusResponse>('/api/sync/status')
      const event = status.recent.find((item) => item.id === id)
      if (event?.processedAt) {
        processedAt.value = event.processedAt
        return
      }
    } catch {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}
</script>

<template>
  <div class="space-y-6">
    <header>
      <p class="text-sm font-medium text-muted">A clear path from basket to doorstep</p>
      <h2 class="mt-1 text-3xl font-bold">Your cart</h2>
    </header>
    <UStepper v-model="step" :items="steps" class="w-full" />
    <div v-if="step === 0" class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <UCard>
        <h2 class="text-xl font-bold">Items in your cart</h2>
        <div v-if="cart.lines.value.length" class="mt-3 divide-y divide-default">
          <div
            v-for="line in cart.lines.value"
            :key="line.productId"
            class="flex flex-wrap items-center justify-between gap-3 py-4"
          >
            <div>
              <NuxtLink :to="`/shop/${line.productId}`" class="font-semibold hover:text-primary">{{
                line.name
              }}</NuxtLink>
              <p class="text-sm text-muted">{{ formatPrice(line.priceCents) }} each</p>
            </div>
            <div class="flex items-center gap-3">
              <UInput
                :model-value="line.quantity"
                type="number"
                min="0"
                max="99"
                class="w-20"
                :aria-label="`Quantity of ${line.name}`"
                @update:model-value="updateQuantity(line.productId, Number($event))"
              /><strong>{{ formatPrice(line.priceCents * line.quantity) }}</strong>
            </div>
          </div>
        </div>
        <UEmpty v-else title="Your cart is empty" description="Browse the shop and add something you like."
          ><template #actions><UButton to="/shop">Browse the shop</UButton></template></UEmpty
        >
      </UCard>
      <UCard class="h-fit">
        <h2 class="text-xl font-bold">Checkout details</h2>
        <div class="mt-4 space-y-4">
          <UFormField label="Payment method"
            ><USelect
              v-model="paymentMethod"
              :items="[
                { label: 'Card', value: 'card' },
                { label: 'PayPal', value: 'paypal' },
                { label: 'Cash on delivery', value: 'cash_on_delivery' },
              ]"
              class="w-full"
          /></UFormField>
          <UFormField v-if="paymentMethod === 'card'" label="Card fingerprint"
            ><UInput v-model="cardFingerprint" class="w-full"
          /></UFormField>
          <UFormField label="Device"><UInput v-model="deviceId" class="w-full" /></UFormField>
          <UCheckbox v-model="suspicious" label="Demo: use a suspicious card" />
          <p class="flex justify-between border-t border-default pt-3 text-lg">
            <span>Total</span><strong>{{ formatPrice(cart.totalCents.value) }}</strong>
          </p>
          <UAlert v-if="error" color="error" title="Could not continue" :description="error" />
          <UButton block :loading="busy" :disabled="busy || !cart.lines.value.length" @click="prepareCheckout"
            >Check delivery and safety</UButton
          >
        </div>
      </UCard>
    </div>
    <div v-else-if="step === 1" class="grid gap-5 lg:grid-cols-2">
      <UCard>
        <p class="text-sm text-muted">Before you pay</p>
        <h2 class="text-xl font-bold">Delivery and safety</h2>
        <InsightFeatureInsight class="mt-3" feature="trust" :trace="preview?.trace" />
        <UAlert
          class="mt-4"
          :color="trustColor"
          :title="
            preview?.trust.level === 'clear'
              ? 'No unusual account links found'
              : preview?.trust.level === 'review'
                ? 'A detail needs a closer look'
                : 'Several accounts share checkout details'
          "
          :description="`${preview?.trust.signals.map((signal) => `${signal.detail}.`).join(' ') || 'Your checkout details look familiar.'} Risk score: ${preview?.trust.score ?? '—'}.`"
        />
        <div v-if="preview?.trust.linkedAccounts.length" class="mt-4">
          <p class="font-semibold">Linked accounts</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <UBadge v-for="account in preview.trust.linkedAccounts" :key="account.id" color="warning" variant="subtle"
              >{{ account.name }} · shared {{ account.via.join(', ') }}</UBadge
            >
          </div>
        </div>
        <div class="mt-5 space-y-3">
          <h3 class="font-semibold">Parcel routes</h3>
          <InsightFeatureInsight feature="delivery" :trace="preview?.trace" />
          <article
            v-for="shipment in preview?.delivery.shipments"
            :key="shipment.productId"
            class="rounded-xl border border-default p-4"
          >
            <p class="font-semibold">{{ shipment.productName }}</p>
            <template v-if="shipment.from && shipment.route"
              ><p class="mt-1 text-sm text-muted">
                {{ shipment.route.stops.map((stop) => stop.city).join(' → ') }}
              </p>
              <p class="mt-1 text-sm">About {{ shipment.route.durationMin }} minutes in transit</p></template
            >
            <p v-else class="mt-1 text-sm text-warning">No warehouse can ship this item right now.</p>
          </article>
        </div>
      </UCard>
      <UCard class="h-fit"
        ><h2 class="text-xl font-bold">Payment</h2>
        <InsightFeatureInsight class="mt-3" feature="checkout" :trace="preview?.trace" />
        <p class="mt-3 text-sm text-muted">Total confirmed against current stock</p>
        <p class="mt-1 text-3xl font-bold">{{ formatPrice(preview?.totalCents ?? cart.totalCents.value) }}</p>
        <UAlert v-if="error" class="mt-4" color="error" title="Could not place order" :description="error" />
        <div class="mt-5 flex gap-3">
          <UButton color="neutral" variant="outline" @click="step = 0">Back to cart</UButton
          ><UButton :loading="busy" @click="placeOrder">Place order</UButton>
        </div></UCard
      >
    </div>
    <UCard v-else-if="order" class="mx-auto max-w-3xl">
      <div class="text-center">
        <UBadge color="success" variant="subtle">Order placed</UBadge>
        <h2 class="mt-3 text-3xl font-bold">Thank you</h2>
        <p class="mt-2 text-muted">Order #{{ order.id }} · {{ formatPrice(order.totalCents) }}</p>
      </div>
      <UTimeline
        class="mx-auto mt-8 max-w-xl"
        :items="[
          {
            title: 'Saved securely',
            description: 'Your order and stock update are saved.',
            icon: 'i-lucide-database',
            value: 'saved',
          },
          {
            title: 'Order event delivered',
            description: processedAt ? 'The update reached the live store network.' : 'Waiting for the live update…',
            icon: 'i-lucide-radio',
            value: 'delivered',
          },
          {
            title: 'Recommendations updated',
            description: processedAt
              ? 'Your future picks can reflect this order.'
              : 'Recommendations will refresh once the update arrives.',
            icon: 'i-lucide-sparkles',
            value: 'recommendations',
          },
        ]"
      />
      <p class="mt-5 text-center text-xs text-muted">Update event {{ eventId }}</p>
      <div class="mt-6 flex justify-center gap-3">
        <UButton to="/">Back to For you</UButton
        ><UButton to="/orders" color="neutral" variant="outline">View my orders</UButton>
      </div>
    </UCard>
  </div>
</template>
