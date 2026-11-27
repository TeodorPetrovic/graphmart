import { createError } from 'h3'
import { z } from 'zod'
import { LabError } from '../modules/lab/errors'

export const labParams = z.record(z.string(), z.union([z.number(), z.string()]))

/** Turns lab validation errors into HTTP errors; engine failures are part of the response body. */
export async function labRequest<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (!(error instanceof LabError)) throw error
    throw createError({ statusCode: error.statusCode, statusMessage: 'Lab request failed', message: error.message })
  }
}
