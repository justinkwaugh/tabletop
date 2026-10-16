export type ReplacementOutcome = 'none' | 'replaced' | 'failed'

// A replacement this child asked its supervisor for. A request can stay open until the supervisor
// reports how it ended: Cloud Run allocates CPU to the instance only while a request is open, so a
// replacement starting beside the serving child runs at full speed only while one is.
export class ReplacementRequest {
    private pending?: PromiseWithResolvers<ReplacementOutcome>

    constructor(private readonly send: (message: 'reload') => void) {}

    request(): void {
        this.pending ??= Promise.withResolvers<ReplacementOutcome>()
        this.send('reload')
    }

    settle(message: unknown): void {
        if (message !== 'superseded' && message !== 'replacement-failed') return
        this.pending?.resolve(message === 'superseded' ? 'replaced' : 'failed')
        this.pending = undefined
    }

    outcome(): Promise<ReplacementOutcome> {
        return this.pending?.promise ?? Promise.resolve('none')
    }
}
