import { afterEach, expect, it, vi } from 'vitest'
import { TabletopApi } from './tabletopApi.svelte.js'
const data = { title: { version: 1, revision: 0, values: {} } }
afterEach(() => vi.unstubAllGlobals())
it('uses account-scoped cacheable reads and conditional partial writes', async () => {
    const fetch = vi.fn(
        async () =>
            new Response(JSON.stringify({ status: 'ok', payload: data }), {
                headers: { ETag: '"revision"' }
            })
    )
    vi.stubGlobal('fetch', fetch)
    const api = new TabletopApi('http://localhost')
    const first = await api.getTitlePreferences?.('title', 'user')
    expect(first).toEqual({ data, etag: '"revision"' })
    expect(fetch.mock.calls[0]).toEqual(
        expect.arrayContaining(['http://localhost/api/v1/game/title/preferences?account=user'])
    )
    await api.updateTitlePreferences?.(
        'title',
        'user',
        { scope: 'title', version: 1, set: { display: 'tokens' }, unset: [] },
        '"revision"'
    )
    expect(fetch.mock.calls.at(-1)).toEqual(
        expect.arrayContaining([
            'http://localhost/api/v1/game/title/updateTitlePreferences',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({ 'If-Match': '"revision"' })
            })
        ])
    )
})
it('turns a precondition failure into a retryable preference conflict', async () => {
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('', { status: 412 }))
    )
    const api = new TabletopApi('http://localhost')
    await expect(
        api.updateTitlePreferences?.(
            'title',
            'user',
            { scope: 'title', version: 1, set: {}, unset: [] },
            '"old"'
        )
    ).rejects.toMatchObject({ status: 412 })
})
