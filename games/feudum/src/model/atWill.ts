import { WritLimit } from '../data/writs.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from './gameState.js'
import { cardTurnSeat } from './turns.js'

/** R-4.4-H1, R-4.4-H5 The moments a seat may act at will. */
export type AtWillWindow = 'before-card' | 'hand-selection' | 'nourishing' | 'writ-limit'

/** R-4.4-H1, R-3.1-H1, R-4.10-H4, R-4.4-H5 */
export function atWillWindow(
    state: HydratedFeudumGameState,
    playerId: string
): AtWillWindow | undefined {
    const { selection, nourish } = state.flow
    const turnSeat = cardTurnSeat(state)
    switch (state.machineState) {
        case MachineState.PlayingCards:
            return turnSeat === playerId ? 'before-card' : undefined
        case MachineState.SelectingHands:
            return selection && !selection.finalised.includes(playerId)
                ? 'hand-selection'
                : undefined
        case MachineState.Nourishing:
            return nourish?.pending.includes(playerId) ? 'nourishing' : undefined
        case MachineState.DiscardingWrits:
            return turnSeat === playerId && writsOverLimit(state, playerId)
                ? 'writ-limit'
                : undefined
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

/** R-4.4.4, R-4.4-H9 Every writ held counts; no seat may hold more at any time. */
export function writsOverLimit(state: HydratedFeudumGameState, playerId: string): boolean {
    return state.getPlayerState(playerId).writCount > WritLimit
}

/** R-4.4.4 The seat to discard down first: the turn player, then the others in turn order. */
export function seatOverLimit(state: HydratedFeudumGameState): string | undefined {
    const { turnOrder } = state.turnManager
    const turnPlayerId = cardTurnSeat(state)
    const start = turnPlayerId ? Math.max(turnOrder.indexOf(turnPlayerId), 0) : 0
    return [...turnOrder.slice(start), ...turnOrder.slice(0, start)].find((playerId) =>
        writsOverLimit(state, playerId)
    )
}
