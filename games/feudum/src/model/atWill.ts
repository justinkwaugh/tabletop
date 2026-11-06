import { WritLimit } from '../data/writs.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from './gameState.js'

/** R-4.4-H1, R-4.4-H5 The moments a seat may act at will. */
export type AtWillWindow = 'before-card' | 'hand-selection' | 'nourishing' | 'writ-limit'

/**
 * R-4.4-H1, R-4.4-H5 The one test of whether this seat may act at will now, and in which window: the
 * turn player before a card or over the writ limit, the next finaliser, the seat nourishing asks.
 */
export function atWillWindow(
    state: HydratedFeudumGameState,
    playerId: string
): AtWillWindow | undefined {
    const { turn, selection, nourish } = state.flow
    switch (state.machineState) {
        case MachineState.PlayingCards:
            return turn?.playerId === playerId ? 'before-card' : undefined
        case MachineState.SelectingHands:
            return selection?.playerId === playerId ? 'hand-selection' : undefined
        case MachineState.Nourishing:
            return nourish?.pending[0] === playerId ? 'nourishing' : undefined
        case MachineState.DiscardingWrits:
            return turn?.playerId === playerId ? 'writ-limit' : undefined
        default:
            return undefined
    }
}

/** R-4.2.2, R-4.2-H3 The windows that fall in the seat's own turn. */
export function inOwnTurnWindow(state: HydratedFeudumGameState, playerId: string): boolean {
    const window = atWillWindow(state, playerId)
    return window === 'before-card' || window === 'writ-limit'
}

/** R-4.4-H1 Why an at-will action is refused for the moment, if it is. */
export function reasonNoAtWillWindow(
    state: HydratedFeudumGameState,
    playerId: string
): string | undefined {
    return atWillWindow(state, playerId) ? undefined : "It isn't your turn."
}

/** R-4.4.4 Sealed charters count; the turn can't end above the limit. */
export function writsOverLimit(state: HydratedFeudumGameState, playerId: string): boolean {
    return state.getPlayerState(playerId).writCount > WritLimit
}
