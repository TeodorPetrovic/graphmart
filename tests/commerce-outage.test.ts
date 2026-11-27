import { describe, expect, test } from 'bun:test'
import { Neo4jError } from 'neo4j-driver'
import { isOutage } from '../server/modules/sync/outage'

describe('outbox failure classification', () => {
  test('an unreachable database does not count against the event', () => {
    expect(isOutage(new Neo4jError('down', 'ServiceUnavailable', '50N42', 'down'))).toBe(true)
  })

  test('a broken event does count', () => {
    expect(isOutage(new Neo4jError('bad', 'Neo.ClientError.Statement.TypeError', '22N01', 'bad'))).toBe(false)
    expect(isOutage(new Error('unexpected payload'))).toBe(false)
  })
})
