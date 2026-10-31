import type { Transaction } from '@google-cloud/firestore'
import type { CacheWriteLocks } from '../../cache/cacheWriteScope.js'

export type TransactionParticipant = (
    transaction: Transaction,
    locks: CacheWriteLocks
) => Promise<void>
