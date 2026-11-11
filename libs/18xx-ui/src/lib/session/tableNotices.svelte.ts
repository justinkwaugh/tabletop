import { ActionSource, type GameAction } from '@tabletop/common'

export type TableNotice = { id: number; text: string }

export class TableNotices {
    items: TableNotice[] = $state([])
    private nextId = 0
    private readonly timers = new Map<number, ReturnType<typeof setTimeout>>()

    constructor(
        private readonly quiet: () => boolean,
        private readonly viewerId: () => string | undefined,
        private readonly describe: (action: GameAction) => string | undefined,
        private readonly durationMs = 6000
    ) {}

    observe(action: GameAction | undefined) {
        if (
            !action ||
            this.quiet() ||
            action.source !== ActionSource.User ||
            action.playerId === this.viewerId()
        )
            return
        const text = this.describe(action)
        if (!text) return
        const id = this.nextId++
        this.items = [...this.items, { id, text }]
        this.timers.set(
            id,
            setTimeout(() => this.dismiss(id), this.durationMs)
        )
    }

    dismiss(id: number) {
        clearTimeout(this.timers.get(id))
        this.timers.delete(id)
        this.items = this.items.filter((notice) => notice.id !== id)
    }

    dispose() {
        for (const timer of this.timers.values()) clearTimeout(timer)
        this.timers.clear()
    }
}
