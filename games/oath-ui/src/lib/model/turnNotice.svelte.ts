import type { OathGameSession } from './session.svelte.js'
import { turnNews, type NewsRow, type TurnNews } from './sinceLastTurn.js'
import { readTurnSeen, saveTurnSeen, turnSeenKey } from './turnSeen.js'

/**
 * The "Since your last turn" card: its news while the seat on screen has not cleared this turn.
 * Browser storage is read once and mirrored in state, since a storage write is not reactive.
 */
export class TurnNotice {
    private cleared = $state<Record<string, number | undefined>>({})

    constructor(private readonly session: OathGameSession) {
        const storage = this.storage()
        this.cleared = Object.fromEntries(
            session.game.players.map((player) => [
                player.id,
                readTurnSeen(storage?.getItem(turnSeenKey(session.game.id, player.id)))
            ])
        )
    }

    // The seat's own turn, not yet cleared, with the whole history to read it from.
    private news: TurnNews | undefined = $derived.by(() => {
        const session = this.session
        const seatId = session.myPlayer?.id
        if (seatId === undefined || session.isViewingHistory || !session.hasCompleteHistory) {
            return undefined
        }
        const turn = session.gameState.turnManager.currentTurn()
        if (turn?.playerId !== seatId || this.cleared[seatId] === turn.start) return undefined
        return turnNews({
            viewerId: seatId,
            state: session.gameState.dehydrate(),
            actions: session.actions,
            hydrate: (state) => session.runtime.hydrator.hydrateState(state)
        })
    })

    /** R-9.4 — every row is public; nothing new is no card. */
    get rows(): NewsRow[] {
        return this.news?.rows ?? []
    }

    get open(): boolean {
        return this.rows.length > 0
    }

    clear(): void {
        const seatId = this.session.myPlayer?.id
        const news = this.news
        if (seatId === undefined || news === undefined) return
        this.cleared = { ...this.cleared, [seatId]: news.turnStart }
        saveTurnSeen(this.storage(), turnSeenKey(this.session.game.id, seatId), news.turnStart)
    }

    // A server render has no storage, and a browser blocking site data throws on reaching it.
    private storage(): Storage | undefined {
        try {
            return typeof localStorage === 'undefined' ? undefined : localStorage
        } catch {
            return undefined
        }
    }
}
