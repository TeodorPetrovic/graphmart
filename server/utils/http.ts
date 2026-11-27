import { createError, getQuery, getRouterParam, readBody, type H3Event } from 'h3'
import type { z } from 'zod'

function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  throw createError({
    statusCode: 400,
    statusMessage: 'Invalid request',
    message: result.error.issues.map((i) => `${i.path.join('.') || 'value'}: ${i.message}`).join('; '),
  })
}

export const validQuery = <S extends z.ZodType>(event: H3Event, schema: S) => parse(schema, getQuery(event))

export const validBody = async <S extends z.ZodType>(event: H3Event, schema: S) => parse(schema, await readBody(event))

/** Reads a positive integer route parameter such as `/api/users/:id`. */
export function intParam(event: H3Event, name: string): number {
  const value = Number(getRouterParam(event, name))
  if (!Number.isSafeInteger(value) || value < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request',
      message: `${name} must be a positive integer`,
    })
  }
  return value
}

export const notFound = (message: string) => createError({ statusCode: 404, statusMessage: 'Not found', message })
