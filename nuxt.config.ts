export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  telemetry: false,
  nitro: {
    preset: 'bun',
    // `server/modules` holds our feature modules; without this Nitro loads every file in it as a Nitro module.
    ignore: ['modules/**'],
  },
  ui: { fonts: false },
  typescript: { strict: true },
})
