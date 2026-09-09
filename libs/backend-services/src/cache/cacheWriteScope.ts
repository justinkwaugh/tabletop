export interface CacheWriteLocks {
    addKeys(keys: string[]): Promise<void>
}

export class CacheWriteScope implements CacheWriteLocks {
    private readonly protectedKeys = new Set<string>()
    private pending = Promise.resolve()
    private closed = false

    constructor(
        private readonly acquire: (keys: string[], previouslyOwned: string[]) => Promise<void>,
        private readonly expiresAt: number
    ) {}

    get keys(): string[] {
        return [...this.protectedKeys]
    }

    addKeys(keys: string[]): Promise<void> {
        if (this.closed) {
            return Promise.reject(new Error('Cache write scope is closed'))
        }
        const requested = [...keys]
        this.pending = this.pending.then(async () => {
            this.checkLifetime()
            const previouslyOwned = this.keys
            for (const key of requested) this.protectedKeys.add(key)
            await this.acquire(this.keys, previouslyOwned)
            this.checkLifetime()
        })
        void this.pending.catch(() => {})
        return this.pending
    }

    async close(): Promise<void> {
        this.closed = true
        await this.pending
    }

    private checkLifetime(): void {
        if (performance.now() >= this.expiresAt) {
            throw new Error('Cache write protection lifetime exceeded during acquisition')
        }
    }
}
