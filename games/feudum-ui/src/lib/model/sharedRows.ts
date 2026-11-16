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
    /** R-4.12.3 The one seat asked, the others answering after it. */
    readonly next?: boolean
    /** R-4.10-H4 Asked and yet to answer: every such seat decides at once. */
    readonly deciding?: boolean
}

export interface OrderRow {
    readonly step: 'nourish' | 'landscapes'
    readonly entries: readonly OrderRowEntry[]
}

export interface CombatTallyRow {
    readonly lines: readonly TallyLine[]
}

/** R-4.10-H4 Nourishing asks every pending seat at once; R-4.12.3 landscapes ask one at a time. */
function entriesOf(
    state: HydratedFeudumGameState,
    pending: readonly string[],
    asked: 'together' | 'in-turn'
): readonly OrderRowEntry[] {
    return state.turnManager.turnOrder.map((playerId) => {
        const done = !pending.includes(playerId)
        return {
            playerId,
            done,
            ...(asked === 'together' ? { deciding: !done } : { next: pending[0] === playerId })
        }
    })
}

/** R-4.10, R-4.12.3 Who has answered, and who is deciding (nourishing) or next (landscapes). */
export function orderRowOf(state: HydratedFeudumGameState): OrderRow | undefined {
    const { nourish, landscapes } = state.flow
    if (nourish) {
        return {
            step: 'nourish',
            entries: entriesOf(state, nourish.pending, 'together')
        }
    }
    return landscapes
        ? { step: 'landscapes', entries: entriesOf(state, landscapes.pending, 'in-turn') }
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
