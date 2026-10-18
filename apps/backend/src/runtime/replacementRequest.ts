// Messages a supervisor sends a child about the replacement the child asked for.
export type ReplacementEnded = 'superseded' | 'replacement-failed'
export type ReplacementOutcome = 'none' | ReplacementEnded

export function isReplacementEnded(message: unknown): message is ReplacementEnded {
    return message === 'superseded' || message === 'replacement-failed'
}

// A request can stay open until the supervisor reports how the replacement ended: Cloud Run
// allocates CPU to the instance only while a request is open, so a replacement starting beside the
// serving child runs at full speed only while one is.
export class ReplacementRequest {
    private pending?: PromiseWithResolvers<ReplacementOutcome>
    private superseded = false

    constructor(private readonly send: (message: 'reload') => void) {}

    request(): void {
        // A superseded child is draining; the supervisor no longer replaces it.
        if (this.superseded) return
        this.pending ??= Promise.withResolvers<ReplacementOutcome>()
        this.send('reload')
    }

    settle(message: unknown): void {
        if (!isReplacementEnded(message)) return
        if (message === 'superseded') this.superseded = true
        this.pending?.resolve(message)
        this.pending = undefined
    }

    outcome(): Promise<ReplacementOutcome> {
        if (this.superseded) return Promise.resolve('superseded')
        return this.pending?.promise ?? Promise.resolve('none')
    }
}

// The replacement of this process, settled by its supervisor's messages.
export function supervisedReplacement(send: (message: 'reload') => void): ReplacementRequest {
    const replacement = new ReplacementRequest(send)
    process.on('message', (message) => replacement.settle(message))
    return replacement
}
