import {
    aggregateHistory,
    type HistoryEntry,
    type HistoryGroup
} from '$lib/utils/actionAggregator.js'
import type { FeudumGameSession } from './session.svelte.js'

/** What the list holds to while a replay steps the table back and forward. */
interface Replaying {
    readonly entryId: string
    readonly entries: readonly HistoryEntry[]
    readonly viewerId: string | undefined
}

/**
 * The log's entries as this seat reads them, and the two things a press on one may do. Neither sends
 * anything nor changes the game: both only move what the shared history shows.
 */
export class HistoryLog {
    private replayingNow = $state.raw<Replaying | undefined>(undefined)

    constructor(private readonly session: FeudumGameSession) {}

    /** R-2.2 Follows the displayed state, as the session's Actions do. */
    private readonly displayed: readonly HistoryEntry[] = $derived.by(() => {
        const { gameState, actions } = this.session
        return aggregateHistory(actions, {
            rounds: gameState.roundManager.series,
            epoch: gameState.epoch,
            seats: gameState.turnManager.turnOrder.length
        })
    })

    /** Oldest first; a replay's stepping doesn't reach the list. */
    get entries(): readonly HistoryEntry[] {
        return this.replayingNow?.entries ?? this.displayed
    }

    /** R-5-H1 Whose eyes the list reads with: a replay in a hotseat doesn't hand it to another seat. */
    get viewerId(): string | undefined {
        return this.replayingNow ? this.replayingNow.viewerId : this.session.myPlayerId
    }

    get replaying(): boolean {
        return this.replayingNow !== undefined
    }

    get replayingEntryId(): string | undefined {
        return this.replayingNow?.entryId
    }

    /** The shared history refuses while the table is busy; the buttons say so first. */
    get available(): boolean {
        return !this.replaying && !this.session.history.isDisabled()
    }

    /** Contract, Jump: enters History View at the entry's own index, on no System Action further. */
    async jump({ jumpIndex }: { readonly jumpIndex?: number }) {
        if (jumpIndex === undefined || !this.available) {
            return
        }
        await this.session.history.goToActionIndex(jumpIndex, { exact: true })
    }

    /** Contract, Replay: the entry's whole span on the existing animators, then back where it was. */
    async replay(group: HistoryGroup, options?: { readonly holdMs?: number }) {
        if (!group.replays || !this.available) {
            return
        }
        this.replayingNow = {
            entryId: group.id,
            entries: this.entries,
            viewerId: this.session.myPlayerId
        }
        try {
            await this.session.history.replayRange(group.firstIndex, group.lastIndex, options)
        } finally {
            this.replayingNow = undefined
        }
    }
}
