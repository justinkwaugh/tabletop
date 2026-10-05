import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type { Base } from './pieces.js'
import { placementPopulation } from './surveys.js'

export function systemPopulation(state: HydratedStellarHorizonsGameState, systemId: string) {
    return state
        .systemState(systemId)
        .worlds.reduce((total, world) => total + placementPopulation(world), 0)
}

export function isWinningBase(state: HydratedStellarHorizonsGameState, base: Base): boolean {
    const scenario = state.scenarioDefinition()
    return (
        base.settlements >= scenario.victorySettlements &&
        systemPopulation(state, base.systemId) >= scenario.victorySystemPopulation
    )
}

export function victoriousPlayerIds(state: HydratedStellarHorizonsGameState): string[] {
    return state
        .initiativeOrder()
        .filter((playerId) => state.basesOf(playerId).some((base) => isWinningBase(state, base)))
}
