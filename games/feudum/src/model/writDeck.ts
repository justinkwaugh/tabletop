import { assert } from '@tabletop/common'
import type { WritId } from '../data/writs.js'
import type { HydratedFeudumGameState } from './gameState.js'
import type { KnownDeckWrit } from './playerState.js'

/** R-5.1 The deck's size is public; only its order is not. */
export function writDeckCount(state: HydratedFeudumGameState): number {
    return state.writDeck.nextBottom - state.writDeck.top
}

/**
 * R-5.1 A draw takes slot `top` and increments it. R-4.4-H2 A draw larger than the deck draws what
 * is there; an empty deck draws nothing. A known position is in the deck while its slot is at or
 * above `top`, so an entry drops once its writ is drawn and the rest need no rewriting.
 */
export function drawWrits(state: HydratedFeudumGameState, count: number): WritId[] {
    const vault = state.requireVault()
    const drawn = vault.writDeck.splice(0, Math.min(count, writDeckCount(state)))
    assert(
        drawn.every(({ slot }, index) => slot === state.writDeck.top + index),
        'The writ deck in the vault must run in slot order from top'
    )
    state.writDeck.top += drawn.length

    const stillInDeck = ({ slot }: KnownDeckWrit) => slot >= state.writDeck.top
    state.publicDeckWrits = state.publicDeckWrits.filter(stillInDeck)
    for (const player of state.players) {
        player.deckKnowledge = player.requireDeckKnowledge().filter(stillInDeck)
    }
    return drawn.map(({ writId }) => writId)
}

/** R-4.4.2 Played mandates: the table sees them go under. */
export function putWritsUnderInView(state: HydratedFeudumGameState, writIds: readonly WritId[]) {
    state.publicDeckWrits.push(...writIds.map((writId) => putWritUnder(state, writId)))
}

/**
 * R-4.4.1, R-4.4-H3, R-4.4.4 A draw's unkept writs, in the order drawn, and a discard: only the
 * seat that puts them under sees them.
 */
export function putWritsUnderUnseen(
    state: HydratedFeudumGameState,
    playerId: string,
    writIds: readonly WritId[]
) {
    state
        .getPlayerState(playerId)
        .requireDeckKnowledge()
        .push(...writIds.map((writId) => putWritUnder(state, writId)))
}

/** R-5.1 A writ going under takes slot `nextBottom` and increments it. */
function putWritUnder(state: HydratedFeudumGameState, writId: WritId): KnownDeckWrit {
    const slot = state.writDeck.nextBottom
    state.requireVault().writDeck.push({ slot, writId })
    state.writDeck.nextBottom += 1
    return { slot, writId }
}
