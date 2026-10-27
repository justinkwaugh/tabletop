import type { OAuthStateRecord } from '../../oauth/oauthState.js'
import type { OAuthStateStore } from '../stores/oauthStateStore.js'

export class MemoryOAuthStateStore implements OAuthStateStore {
    private readonly records = new Map<string, OAuthStateRecord>()

    async create(record: OAuthStateRecord): Promise<void> {
        if (this.records.has(record.state)) {
            throw new Error(`OAuth state ${record.state} already exists`)
        }
        this.records.set(record.state, structuredClone(record))
    }

    async consume(state: string): Promise<OAuthStateRecord | undefined> {
        const record = this.records.get(state)
        this.records.delete(state)
        return record ? structuredClone(record) : undefined
    }

    get size(): number {
        return this.records.size
    }
}
