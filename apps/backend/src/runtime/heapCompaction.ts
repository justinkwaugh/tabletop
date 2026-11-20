import { getHeapStatistics } from 'node:v8'

const mebibytes = (bytes: number) => Math.round(bytes / (1024 * 1024))

// A compaction pauses the worker for about two seconds after a live logic publication, so
// publications that follow one another share one; the next activation outside this interval
// compacts what the skipped ones left.
const MINIMUM_INTERVAL_MS = 5 * 60_000

// Loading titles leaves the heap fragmented, and V8's ordinary collections do not return the freed
// pages to the system; a last-resort collection compacts them. `gc` exists under --expose-gc, and
// its options are not a stable V8 interface, so a collection that throws leaves the titles serving.
export class HeapCompactor {
    private compactedAt?: number

    constructor(private readonly collectGarbage: NodeJS.GCFunction) {}

    isDue(): boolean {
        return (
            this.compactedAt === undefined ||
            performance.now() - this.compactedAt >= MINIMUM_INTERVAL_MS
        )
    }

    compact(): void {
        const before = process.memoryUsage()
        const startedAt = performance.now()
        this.compactedAt = startedAt
        try {
            this.collectGarbage({ type: 'major', execution: 'sync', flavor: 'last-resort' })
        } catch (error) {
            console.warn('Heap compaction failed; the loaded titles keep serving', error)
            return
        }
        const ms = Math.round(performance.now() - startedAt)
        const after = process.memoryUsage()
        console.log(
            JSON.stringify({
                severity: 'INFO',
                event: 'heap_compaction',
                message: `Heap compacted: RSS ${mebibytes(before.rss)} to ${mebibytes(after.rss)} MiB`,
                ms,
                rssBeforeMiB: mebibytes(before.rss),
                rssAfterMiB: mebibytes(after.rss),
                heapTotalBeforeMiB: mebibytes(before.heapTotal),
                heapTotalAfterMiB: mebibytes(after.heapTotal),
                heapUsedAfterMiB: mebibytes(after.heapUsed),
                externalAfterMiB: mebibytes(after.external),
                heapLimitMiB: mebibytes(getHeapStatistics().heap_size_limit)
            })
        )
    }
}
