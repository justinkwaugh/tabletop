import { findLast } from '@tabletop/common'
import type { FeudumGameState } from './gameState.js'

export interface TurnsHolder {
    readonly flow: { readonly turn?: object }
    readonly turnManager: Pick<FeudumGameState['turnManager'], 'series'>
}

export function openTurnSeat(state: Pick<TurnsHolder, 'turnManager'>): string | undefined {
    return findLast(state.turnManager.series, (turn) => !turn.end)?.playerId
}

/** R-3.2 The seat whose card turn it is, while cards are played: the turn manager's open turn. */
export function cardTurnSeat(state: TurnsHolder): string | undefined {
    return state.flow.turn ? openTurnSeat(state) : undefined
}

/** R-1.4.8, R-1.4.9 The seat choosing in setup: the turn manager's open turn. */
export function setupSeat(state: TurnsHolder): string | undefined {
    return openTurnSeat(state)
}
