<script setup lang="ts">
import { useActiveUser } from '~/composables/useActiveUser'
import { useCart } from '~/composables/useCart'

const route = useRoute()
const userId = useActiveUser()
const cart = useCart()
const titles: Record<string, string> = {
  '/': 'For you',
  '/shop': 'Products',
  '/cart': 'Cart',
  '/orders': 'Orders',
  '/social': 'People',
  '/fraud': 'Fraud review',
  '/logistics': 'Delivery',
  '/analytics': 'Sales',
  '/lab': 'Comparisons',
  '/model': 'Data model',
  '/sync': 'Sync',
  '/present': 'Lecture plan',
}
const pageTitle = computed(
  () =>
    titles[route.path] ??
    (route.path.startsWith('/shop/') ? 'Product' : route.path.startsWith('/lab/') ? 'Comparison' : 'GraphMart'),
)
const link = (to: string, icon: string) => ({ label: titles[to], icon: `i-lucide-${icon}`, to })
const group = (label: string) => ({ label, type: 'label' as const })
const items = computed(() => [
  [
    group('Shop'),
    link('/', 'house'),
    link('/shop', 'package'),
    { ...link('/cart', 'shopping-cart'), badge: cart.count.value || undefined },
    link('/orders', 'receipt'),
    link('/social', 'users'),
  ],
  [group('Staff'), link('/fraud', 'shield'), link('/logistics', 'truck'), link('/analytics', 'chart-column')],
  [
    group('Course'),
    link('/lab', 'gauge'),
    link('/model', 'database'),
    link('/sync', 'refresh-cw'),
    link('/present', 'list-checks'),
  ],
])
</script>

<template>
  <!-- Sidebar sizes below are pixels; the component default unit is percent. -->
  <UDashboardGroup unit="px">
    <UDashboardSidebar collapsible resizable :default-size="240" :min-size="200" :max-size="320" :collapsed-size="64">
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="px-2 font-semibold">{{ collapsed ? 'GM' : 'GraphMart' }}</NuxtLink>
      </template>
      <template #default="{ collapsed }">
        <UserPicker v-if="!collapsed" v-model="userId" label="Shopping as" class="px-2" />
        <UNavigationMenu :items="items" orientation="vertical" :collapsed="collapsed" class="w-full" />
      </template>
      <template #footer>
        <UColorModeButton />
        <UDashboardSidebarCollapse />
      </template>
    </UDashboardSidebar>
    <UDashboardPanel>
      <UDashboardNavbar :title="pageTitle">
        <template #leading><UDashboardSidebarToggle class="lg:hidden" /></template>
      </UDashboardNavbar>
      <div class="min-h-0 flex-1 overflow-y-auto">
        <main class="w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6">
          <slot />
        </main>
      </div>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
