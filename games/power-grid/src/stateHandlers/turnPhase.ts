import type { HydratedPowerGridGameState, PhaseName } from '../model/gameState.js'

export function enterTurnPhase(
    state: HydratedPowerGridGameState,
    phase: PhaseName,
    order: readonly string[]
) {
    state.enterPhase(phase)
    const next = state.nextUndone(order)
    if (!next) {
        throw Error(`No player left to act in the ${phase} phase`)
    }
    state.startTurn(next)
}
