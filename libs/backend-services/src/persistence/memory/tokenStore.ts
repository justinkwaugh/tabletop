import type { DataToken } from '../../tokens/dataToken.js'
import type { TokenStore } from '../stores/tokenStore.js'
import { AlreadyExistsError } from '../stores/errors.js'

export class MemoryTokenStore implements TokenStore {
    private readonly records = new Map<string, DataToken>()

    async create(token: DataToken): Promise<DataToken> {
        if (this.records.has(token.id)) {
            throw new AlreadyExistsError({ type: 'DataToken', id: token.id, field: 'id' })
        }
        await this.replace(token)
        return structuredClone(token)
    }

    async replace(token: DataToken): Promise<void> {
        this.records.set(token.id, structuredClone(token))
    }

    async find(key: string): Promise<DataToken | undefined> {
        const record = this.records.get(key)
        return record ? structuredClone(record) : undefined
    }

    async delete(key: string): Promise<void> {
        this.records.delete(key)
    }

    get size(): number {
        return this.records.size
    }
}
