import type { AuthenticationChallengeRecord } from '../../challenges/authenticationChallenge.js'
import type { AuthenticationChallengeStore } from '../stores/authenticationChallengeStore.js'

export class MemoryAuthenticationChallengeStore implements AuthenticationChallengeStore {
    private readonly records = new Map<string, AuthenticationChallengeRecord>()

    async replace(key: string, record: AuthenticationChallengeRecord): Promise<void> {
        this.records.set(key, structuredClone(record))
    }

    async find(
        _transaction: unknown,
        key: string
    ): Promise<AuthenticationChallengeRecord | undefined> {
        const record = this.records.get(key)
        return record ? structuredClone(record) : undefined
    }

    delete(_transaction: unknown, key: string): void {
        this.records.delete(key)
    }

    stored(key: string): AuthenticationChallengeRecord | undefined {
        const record = this.records.get(key)
        return record ? structuredClone(record) : undefined
    }

    get size(): number {
        return this.records.size
    }
}
