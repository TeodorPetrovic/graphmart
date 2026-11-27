import type { ClientSession } from 'mongodb'
import { mongoClient } from './client'

let replicaSet: Promise<boolean> | null = null

/** Transactions and change streams need a replica set or a sharded cluster. */
export function supportsTransactions(): Promise<boolean> {
  replicaSet ??= mongoClient()
    .db('admin')
    .command({ hello: 1 })
    .then((hello) => Boolean(hello.setName) || hello.msg === 'isdbgrid')
    .catch((error: unknown) => {
      replicaSet = null
      throw error
    })
  return replicaSet
}

export interface WriteScope {
  /** Pass to every operation. Undefined on a single server. */
  session: ClientSession | undefined
  /** Says how to reverse a write that succeeded. Used only when there is no transaction. */
  onFailure: (undo: () => Promise<unknown>) => void
}

/**
 * Runs writes that belong together. A replica set does it in one transaction. A single server
 * cannot, so the writes run one by one and are reversed if a later one fails. That covers
 * errors such as running out of stock, but not the app or the server stopping half way.
 */
export async function writeTogether<T>(work: (scope: WriteScope) => Promise<T>): Promise<T> {
  if (await supportsTransactions()) {
    const session = mongoClient().startSession()
    try {
      return await session.withTransaction(() => work({ session, onFailure: () => undefined }))
    } finally {
      await session.endSession()
    }
  }
  const undos: (() => Promise<unknown>)[] = []
  try {
    return await work({ session: undefined, onFailure: (undo) => undos.push(undo) })
  } catch (error) {
    for (const undo of undos.reverse()) {
      await undo().catch((undoError: unknown) => console.error('Could not reverse a write', undoError))
    }
    throw error
  }
}
