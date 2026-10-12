import type { HydratedStellarHorizonsGameState } from './gameState.js'

export function startingBaseSystemIds(state: HydratedStellarHorizonsGameState): readonly string[] {
    return state.scenarioDefinition().startingBase?.systemIds ?? []
}

// Starting bases are placed in reverse initiative order (rulebook 2.3).
export function nextStartingBasePlacer(
    state: HydratedStellarHorizonsGameState
): string | undefined {
    if (!state.scenarioDefinition().startingBase) {
        return undefined
    }
    return state
        .initiativeOrder()
        .toReversed()
        .find((playerId) => state.basesOf(playerId).length === 0)
}
