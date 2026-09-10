import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocalTaskService } from './localTasksService.js'

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe('local delayed tasks', () => {
    it('returns after enqueue and waits until the deadline before delivery', async () => {
        vi.useFakeTimers()
        const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('{}'))
        vi.stubGlobal('fetch', fetch)
        const tasks = new LocalTaskService('http://localhost:3000')
        await tasks.createPushTask({
            queue: 'tournaments',
            path: '/tournaments/dispatch',
            payload: { tournamentId: 'event' },
            inSeconds: 60
        })
        expect(fetch).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(59_999)
        expect(fetch).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(1)
        expect(fetch).toHaveBeenCalledOnce()
        const headers = new Headers(fetch.mock.calls[0][1]?.headers)
        expect(headers.has('authorization')).toBe(false)
        tasks.close()
    })
    it('retries failed delivery and discards timers on shutdown', async () => {
        vi.useFakeTimers()
        const fetch = vi
            .fn<typeof globalThis.fetch>()
            .mockResolvedValueOnce(new Response('{}', { status: 503 }))
            .mockResolvedValue(new Response('{}'))
        vi.stubGlobal('fetch', fetch)
        const tasks = new LocalTaskService('http://localhost:3000')
        await tasks.createPushTask({
            queue: 'tournaments',
            path: '/tournaments/dispatch',
            payload: {}
        })
        await vi.advanceTimersByTimeAsync(0)
        expect(fetch).toHaveBeenCalledOnce()
        await vi.advanceTimersByTimeAsync(30_000)
        expect(fetch).toHaveBeenCalledTimes(2)
        await tasks.createPushTask({
            queue: 'tournaments',
            path: '/tournaments/dispatch',
            payload: {},
            inSeconds: 10
        })
        tasks.close()
        await vi.advanceTimersByTimeAsync(10_000)
        expect(fetch).toHaveBeenCalledTimes(2)
    })
})
