<script setup lang="ts">
import type { UserOrdersResponse, UserProfileResponse } from '#shared/types/api'
import { useActiveUser } from '~/composables/useActiveUser'
import { formatPrice } from '#shared/utils/demo'
const userId = useActiveUser()
const profilePath = computed(() => `/api/users/${userId.value}`)
const ordersPath = computed(() => `/api/users/${userId.value}/orders`)
const profile = useFetch<UserProfileResponse>(() => profilePath.value, { watch: [userId] })
const orders = useFetch<UserOrdersResponse>(() => ordersPath.value, { watch: [userId] })
const profileLoadError = useLoadError(profile.error)
const ordersLoadError = useLoadError(orders.error)
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="My orders" description="Everything you bought, with the price you paid at the time." />
    <LoadState :status="profile.status.value" :error="profileLoadError"
      ><section v-if="profile.data.value" class="rounded-2xl border border-default bg-elevated/30 p-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-sm text-muted">Signed in as</p>
            <h2 class="text-2xl font-bold">{{ profile.data.value.user.name }}</h2>
            <p class="text-muted">
              {{ profile.data.value.user.email }} · {{ profile.data.value.user.city }},
              {{ profile.data.value.user.country }}
            </p>
          </div>
          <UBadge color="primary" variant="subtle"
            >{{ profile.data.value.user.tier }} tier · #{{ profile.data.value.user.id }}</UBadge
          >
        </div>
        <div class="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <p class="text-xs uppercase tracking-wider text-muted">Social connections</p>
            <p class="mt-1 font-semibold">
              {{ profile.data.value.social.following }} following · {{ profile.data.value.social.followers }} followers
            </p>
          </div>
          <div class="sm:col-span-2">
            <p class="text-xs uppercase tracking-wider text-muted">Interests</p>
            <p class="mt-1">{{ profile.data.value.user.interests.join(' · ') }}</p>
          </div>
        </div>
      </section></LoadState
    >
    <section class="rounded-2xl border border-default p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-sm text-muted">Your purchases, all in one place</p>
          <h2 class="text-2xl font-bold">Order history</h2>
        </div>
        <span class="text-sm text-muted">{{ orders.data.value?.orders.length ?? 0 }} orders</span>
      </div>
      <InsightFeatureInsight class="mt-4" feature="orders" :trace="orders.data.value?.trace" />
      <LoadState :status="orders.status.value" :error="ordersLoadError"
        ><div class="mt-5 space-y-3">
          <article
            v-for="order in orders.data.value?.orders"
            :key="order.id"
            class="rounded-xl border border-default bg-elevated/25 p-4"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="font-bold">Order #{{ order.id }}</h3>
                <p class="mt-1 flex items-center gap-2 text-sm text-muted">
                  {{ formatTimestamp(order.createdAt).slice(0, 10) }}
                  <UBadge :color="order.status === 'cancelled' ? 'error' : 'success'" variant="subtle">
                    {{ order.status }}
                  </UBadge>
                </p>
              </div>
              <strong class="text-lg">{{ formatPrice(order.totalCents) }}</strong>
            </div>
            <ul class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
              <li v-for="item in order.items" :key="item.productId">{{ item.quantity }} × {{ item.name }}</li>
            </ul>
          </article>
          <p v-if="!orders.data.value?.orders.length" class="py-7 text-center text-muted">
            No orders yet. Visit the shop to get started.
          </p>
        </div></LoadState
      >
    </section>
  </div>
</template>
