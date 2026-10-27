import type { Transaction } from '@google-cloud/firestore'
import type { AuthenticationChallengeRecord } from '../../challenges/authenticationChallenge.js'

export interface AuthenticationChallengeStore {
    replace(key: string, record: AuthenticationChallengeRecord): Promise<void>
    find(transaction: Transaction, key: string): Promise<AuthenticationChallengeRecord | undefined>
    delete(transaction: Transaction, key: string): void
}
