import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Type from 'typebox'
import type { PreferenceRecord, TitlePreferenceDefinition } from '@tabletop/common'
import { PreferenceService } from './preferenceService.js'
import type { PreferenceStore } from './preferenceStore.js'
import { cacheFixture } from '../cache/tests/cacheFixture.js'

const schema = Type.Object({ compact: Type.Boolean() }, { additionalProperties: false })
const definition = {
    title: { schema, defaults: { compact: false }, version: 1 },
    family: { id: 'family', schema, defaults: { compact: false }, version: 1 }
} satisfies TitlePreferenceDefinition<typeof schema>
class MemoryStore implements PreferenceStore {
    records = new Map<string, PreferenceRecord>()
    read = vi.fn(async (user: string, scopes: readonly string[]) =>
        scopes.map((scope) => this.records.get(`${user}/${scope}`))
    )
    async update(
        user: string,
        scopes: readonly string[],
        change: Parameters<PreferenceStore['update']>[2]
    ) {
        const result = change(await this.read(user, scopes))
        this.records.set(
            `${user}/${scopes[result.changedIndex]}`,
            result.records[result.changedIndex]
        )
        return result.records
    }
}
function fixture() {
    const { cache, client, pool, guardPool } = cacheFixture()
    vi.spyOn(pool, 'execute').mockImplementation(async (operation) => operation(client))
    vi.spyOn(guardPool, 'execute').mockImplementation(async (operation) => operation(client))
    vi.spyOn(client, 'isOpen', 'get').mockReturnValue(true)
    vi.spyOn(client, 'watch').mockResolvedValue('OK')
    vi.spyOn(client, 'unwatch').mockResolvedValue('OK')
    vi.spyOn(client, 'mGet').mockResolvedValue([])
    const transaction = client.multi()
    vi.spyOn(client, 'multi').mockReturnValue(transaction)
    vi.spyOn(transaction, 'exec').mockResolvedValue([])
    const cached = new Map<string, unknown>()
    vi.spyOn(cache, 'cacheGetMulti').mockImplementation(async (keys) =>
        keys.map((key) => ({ cached: cached.has(key), value: cached.get(key) }))
    )
    vi.spyOn(cache, 'cacheSetMulti').mockImplementation(async (requests) => {
        for (const request of requests) cached.set(request.key, request.value)
    })
    const store = new MemoryStore()
    return { service: new PreferenceService(store, cache), store, cache, cached, client }
}
afterEach(() => vi.restoreAllMocks())
describe('preference storage and revision caching', () => {
    it('returns a warm matching ETag without database reads and caches only revision metadata', async () => {
        const { service, store, cached } = fixture()
        const first = await service.read('alice', 'one', definition)
        expect(store.read).toHaveBeenCalledTimes(1)
        store.read.mockClear()
        expect(await service.read('alice', 'one', definition, first.etag)).toEqual({
            etag: first.etag,
            data: undefined
        })
        expect(store.read).not.toHaveBeenCalled()
        expect([...cached.values()]).toEqual([{ revision: 0 }, { revision: 0 }])
    })
    it('shares family records across titles, isolates users, and rejects a stale conditional write', async () => {
        const { service, store } = fixture()
        const first = await service.read('alice', 'one', definition)
        const change = { scope: 'family' as const, version: 1, set: { compact: true }, unset: [] }
        const changed = await service.update('alice', 'one', definition, change, first.etag)
        expect(changed.data.family?.values).toEqual({ compact: true })
        expect((await service.read('alice', 'two', definition)).data?.family?.values).toEqual({
            compact: true
        })
        expect((await service.read('bob', 'one', definition)).data?.family?.values).toEqual({})
        await expect(
            service.update('alice', 'one', definition, change, first.etag)
        ).rejects.toMatchObject({ status: 412 })
        expect(store.records.size).toBe(1)
    })
    it('bypasses a matching cache revision while a writer is active', async () => {
        const { service, store, client } = fixture()
        const first = await service.read('alice', 'one', definition)
        store.read.mockClear()
        vi.mocked(client.mGet).mockResolvedValue(['L:W:.writer'])
        expect((await service.read('alice', 'one', definition, first.etag)).data).toBeDefined()
        expect(store.read).toHaveBeenCalledTimes(1)
    })
})

it('changes ETags when the loaded schema changes, including an unwritten family record', async () => {
    const { service } = fixture()
    const first = await service.read('alice', 'one', definition)
    const next = { ...definition, family: { ...definition.family, version: 2 } }
    const newer = await service.read('alice', 'one', next, first.etag)
    expect(newer.data?.family?.version).toBe(2)
    expect(newer.etag).not.toBe(first.etag)
    const saved = await service.update(
        'alice',
        'one',
        next,
        { scope: 'family', version: 2, set: { compact: true }, unset: [] },
        newer.etag
    )
    expect(saved.data.family?.values).toEqual({ compact: true })
})
