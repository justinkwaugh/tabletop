import { HydratedOathGameState } from '../model/gameState.js'

/** R-7.1.2.a — holding the turn; an asked player is active without having it. */
export function holdsTheTurn(state: HydratedOathGameState, playerId: string): boolean {
    return state.turnManager.currentTurn()?.playerId === playerId
}

export function reasonNotYourTurn(
    state: HydratedOathGameState,
    playerId: string
): string | undefined {
    const current = state.turnManager.currentTurn()
    if (!current) return 'no turn is in progress'
    if (current.playerId !== playerId) return `it is ${current.playerId}’s turn`
    return undefined
}
