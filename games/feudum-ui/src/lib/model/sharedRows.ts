import { strengthOf, type HydratedFeudumGameState } from '@tabletop/feudum'
import { tallyLines, type TallyLine } from './cardFlows.js'

/**
 * The rows of a shared step, read from `flow` on the displayed state and from no seat's own: the seat
 * deciding and the seats waiting draw the same one (contract: Render ownership).
 */
export interface OrderRowEntry {
    readonly playerId: string
    /** Not asked, or already answered. */
    readonly done: boolean
    readonly next: boolean
    /** R-4.10, R-4.10-H4 It had no choice, so the game fed it. */
    readonly fedByGame?: boolean
}

export interface OrderRow {
    readonly step: 'nourish' | 'landscapes'
    readonly entries: readonly OrderRowEntry[]
}

export interface CombatTallyRow {
    readonly lines: readonly TallyLine[]
}

function entriesOf(
    state: HydratedFeudumGameState,
    pending: readonly string[],
    fedByGame: readonly string[]
): readonly OrderRowEntry[] {
    return state.turnManager.turnOrder.map((playerId) => ({
        playerId,
        done: !pending.includes(playerId),
        next: pending[0] === playerId,
        ...(fedByGame.includes(playerId) ? { fedByGame: true } : {})
    }))
}

/** R-4.10, R-4.12.3 Who has answered, who is next. R-4.10-H4 `fedByGame` names the seats it fed itself. */
export function orderRowOf(
    state: HydratedFeudumGameState,
    fedByGame: readonly string[]
): OrderRow | undefined {
    const { nourish, landscapes } = state.flow
    if (nourish) {
        return { step: 'nourish', entries: entriesOf(state, nourish.pending, fedByGame) }
    }
    return landscapes
        ? { step: 'landscapes', entries: entriesOf(state, landscapes.pending, []) }
        : undefined
}

/**
 * R-4.8.2 The combat as it stands: what the flow holds, a flipped Defend once it is face up, and
 * nothing the attacker has not committed. It reads no hand, so it can't differ with one (S34). Who
 * answers is the waiting line's to say, to every seat but the one answering (R-3.14.1).
 */
export function combatTallyOf(state: HydratedFeudumGameState): CombatTallyRow | undefined {
    const { combat } = state.flow
    if (!combat) {
        return undefined
    }
    return { lines: tallyLines(strengthOf(state, combat, 0, 0)) }
}
