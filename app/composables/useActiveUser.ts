import { DEMO } from '#shared/utils/demo'

/** The user the demo is "logged in" as. There is intentionally no authentication. */
export function useActiveUser() {
  const cookie = useCookie<number>('graphmart-user', { default: () => DEMO.userId })
  const userId = useState<number>('active-user', () => cookie.value)
  watch(userId, (value) => {
    cookie.value = value
  })
  return userId
}
