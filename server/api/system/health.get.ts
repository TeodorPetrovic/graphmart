import { engineHealth } from '../../modules/system/system.repository'
export default defineEventHandler(() => engineHealth())
