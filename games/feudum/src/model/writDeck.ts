import { assert } from '@tabletop/common'
import type { WritId } from '../data/writs.js'
import type { HydratedFeudumGameState } from './gameState.js'
import type { KnownDeckWrit } from './playerState.js'

/** R-5.1 The deck's size is public; only its order is not. */
export function writDeckCount(state: HydratedFeudumGameState): number {
    return state.writDeck.nextBottom - state.writDeck.top
}

/** R-5.1, R-4.4-H2 A known position drops once its slot is below `top`. */
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

/** R-4.4.1, R-4.4-H3, R-4.4.4 */
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
