import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { placementPopulation } from './surveys.js'

export function systemPopulation(state: HydratedStellarHorizonsGameState, systemId: string) {
    return state
        .systemState(systemId)
        .worlds.reduce((total, world) => total + placementPopulation(world), 0)
}

export function victoriousPlayerIds(state: HydratedStellarHorizonsGameState): string[] {
    const scenario = state.scenarioDefinition()
    return state
        .initiativeOrder()
        .filter((playerId) =>
            state
                .basesOf(playerId)
                .some(
                    (base) =>
                        base.settlements >= scenario.victorySettlements &&
                        systemPopulation(state, base.systemId) >= scenario.victorySystemPopulation
                )
        )
}
