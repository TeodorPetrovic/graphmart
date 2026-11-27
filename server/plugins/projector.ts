import { startProjector, stopProjector } from '../modules/sync/projector'

const key = Symbol.for('graphmart.projector.started')
export default defineNitroPlugin((nitro) => {
  if (Reflect.get(globalThis, key)) return
  Reflect.set(globalThis, key, true)
  void startProjector().catch((error: unknown) => console.error('Outbox projector startup failed', error))
  nitro.hooks.hook('close', async () => {
    await stopProjector()
    Reflect.set(globalThis, key, false)
  })
})
