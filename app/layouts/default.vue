<script setup lang="ts">
import { useActiveUser } from '~/composables/useActiveUser'
import { useCart } from '~/composables/useCart'

const route = useRoute()
const userId = useActiveUser()
const cart = useCart()
const colorMode = useColorMode()
const titles: Record<string, string> = {
  '/': 'For you',
  '/shop': 'Browse',
  '/cart': 'Cart',
  '/orders': 'My orders',
  '/social': 'People',
  '/fraud': 'Trust & safety',
  '/logistics': 'Delivery',
  '/analytics': 'Store insights',
  '/lab': 'Performance lab',
  '/model': 'Data model',
  '/sync': 'Live sync',
  '/present': 'Lecture guide',
}
const pageTitle = computed(
  () =>
    titles[route.path] ??
    (route.path.startsWith('/shop/') ? 'Product' : route.path.startsWith('/lab/') ? 'Performance lab' : 'GraphMart'),
)
const primaryItems = computed(() => [
  [
    { label: 'Shop', type: 'label' as const },
    { label: 'For you', icon: 'i-lucide-sparkles', to: '/' },
    { label: 'Browse', icon: 'i-lucide-search', to: '/shop' },
    { label: 'Cart', icon: 'i-lucide-shopping-bag', to: '/cart', badge: cart.count.value || undefined },
    { label: 'My orders', icon: 'i-lucide-package-check', to: '/orders' },
  ],
  [
    { label: 'Community', type: 'label' as const },
    { label: 'People', icon: 'i-lucide-users-round', to: '/social' },
  ],
  [
    { label: 'Store team', type: 'label' as const },
    { label: 'Trust & safety', icon: 'i-lucide-shield-check', to: '/fraud' },
    { label: 'Delivery', icon: 'i-lucide-truck', to: '/logistics' },
    { label: 'Store insights', icon: 'i-lucide-chart-no-axes-combined', to: '/analytics' },
  ],
])
const secondaryItems = [
  { label: 'Performance lab', icon: 'i-lucide-flask-conical', to: '/lab' },
  { label: 'Data model', icon: 'i-lucide-network', to: '/model' },
  { label: 'Live sync', icon: 'i-lucide-radio', to: '/sync' },
  { label: 'Lecture guide', icon: 'i-lucide-presentation', to: '/present' },
]
</script>

<template>
  <!-- Sidebar sizes below are pixels; the component default unit is percent. -->
  <UDashboardGroup unit="px">
    <UDashboardSidebar
      collapsible
      resizable
      :default-size="264"
      :min-size="220"
      :max-size="320"
      :collapsed-size="72"
      class="bg-elevated/30"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="flex min-w-0 items-center gap-3 px-3 py-2">
          <span class="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-lg font-black text-inverted"
            >G</span
          >
          <span v-if="!collapsed" class="min-w-0">
            <span class="block font-bold">GraphMart</span>
            <span class="block text-xs text-muted">A shop shaped around you</span>
          </span>
        </NuxtLink>
      </template>
      <template #default="{ collapsed }">
        <div class="px-3 pb-4">
          <div v-if="!collapsed" class="mb-2 flex items-center gap-2">
            <UAvatar :alt="`Shopper ${userId}`" size="sm" />
            <span class="text-sm font-semibold">Shopping as</span>
          </div>
          <UserPicker v-model="userId" :label="collapsed ? 'Shopper' : 'Choose a shopper'" />
        </div>
        <UNavigationMenu
          :items="primaryItems"
          orientation="vertical"
          :collapsed="collapsed"
          class="w-full"
          :ui="{ link: 'text-sm' }"
        >
          <template #item-trailing="{ item }">
            <UBadge v-if="item.badge" color="primary" size="sm" variant="solid">{{ item.badge }}</UBadge>
          </template>
        </UNavigationMenu>
        <div class="mt-auto border-t border-default px-3 pt-3">
          <p v-if="!collapsed" class="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Behind the scenes
          </p>
          <UNavigationMenu :items="secondaryItems" orientation="vertical" :collapsed="collapsed" class="w-full" />
        </div>
      </template>
      <template #footer="{ collapsed }">
        <div class="flex items-center justify-between gap-2 border-t border-default p-3">
          <span v-if="!collapsed" class="text-sm text-muted">Appearance</span>
          <UColorModeButton />
          <UDashboardSidebarCollapse />
        </div>
      </template>
    </UDashboardSidebar>
    <UDashboardPanel>
      <UDashboardNavbar :title="pageTitle" />
      <div class="min-h-0 flex-1 overflow-y-auto">
        <main class="mx-auto w-full max-w-[1600px] space-y-7 px-5 py-7 sm:px-8 lg:px-10">
          <slot />
        </main>
      </div>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
