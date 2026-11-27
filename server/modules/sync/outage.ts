import { Neo4jError } from 'neo4j-driver'

/**
 * True when the failure says nothing about the event itself (Neo4j unreachable, leader switch,
 * transient lock). Such events must wait, not use up their attempts and be given up.
 */
export function isOutage(error: unknown): boolean {
  if (!(error instanceof Neo4jError)) return false
  return error.retriable || error.code === 'ServiceUnavailable' || error.code === 'SessionExpired'
}
