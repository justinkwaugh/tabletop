/** Overlapping loads of the same data, where only the newest may apply its result. */
export class LatestRequest {
    private latest = 0

    /** Starts a load; the check stays true until a newer load starts or the page closes. */
    begin(): () => boolean {
        const id = ++this.latest
        return () => id === this.latest
    }

    /** Makes every load in flight stale. */
    cancel(): void {
        this.latest++
    }
}
