import { afterEach, describe, expect, it, vi } from 'vitest'
import { HeapCompactor } from './heapCompaction.js'

afterEach(() => vi.restoreAllMocks())

describe('heap compaction', () => {
    it('runs one synchronous last-resort collection and logs what it returned', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {})
        const mebibyte = 1024 * 1024
        const usage = (rss: number, heapTotal: number) => ({
            rss: rss * mebibyte,
            heapTotal: heapTotal * mebibyte,
            heapUsed: 270 * mebibyte,
            external: 40 * mebibyte,
            arrayBuffers: 0
        })
        vi.spyOn(process, 'memoryUsage')
            .mockReturnValueOnce(usage(620, 440))
            .mockReturnValueOnce(usage(460, 280))
        const collectGarbage = vi.fn<NodeJS.GCFunction>()

        new HeapCompactor(collectGarbage).compact()

        expect(collectGarbage.mock.calls).toEqual([
            [{ type: 'major', execution: 'sync', flavor: 'last-resort' }]
        ])
        expect(log).toHaveBeenCalledOnce()
        expect(JSON.parse(String(log.mock.calls[0][0]))).toEqual({
            severity: 'INFO',
            event: 'heap_compaction',
            message: 'Heap compacted: RSS 620 to 460 MiB',
            ms: expect.any(Number),
            rssBeforeMiB: 620,
            rssAfterMiB: 460,
            heapTotalBeforeMiB: 440,
            heapTotalAfterMiB: 280,
            heapUsedAfterMiB: 270,
            externalAfterMiB: 40,
            heapLimitMiB: expect.any(Number)
        })
    })

    it('leaves the worker serving when the collection throws', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {})
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const refused = new Error('unsupported collection')

        const compactor = new HeapCompactor(() => {
            throw refused
        })

        expect(() => compactor.compact()).not.toThrow()

        expect(warn).toHaveBeenCalledWith(
            'Heap compaction failed; the loaded titles keep serving',
            refused
        )
        expect(log).not.toHaveBeenCalled()
    })

    it('is due at first, then not again until five minutes after the last compaction', () => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        const clock = vi.spyOn(performance, 'now')
        const minute = 60_000
        const compactor = new HeapCompactor(vi.fn<NodeJS.GCFunction>())

        clock.mockReturnValue(10 * minute)
        expect(compactor.isDue()).toBe(true)
        compactor.compact()

        clock.mockReturnValue(11 * minute)
        expect(compactor.isDue()).toBe(false)
        clock.mockReturnValue(15 * minute - 1)
        expect(compactor.isDue()).toBe(false)
        clock.mockReturnValue(15 * minute)
        expect(compactor.isDue()).toBe(true)
    })
})
