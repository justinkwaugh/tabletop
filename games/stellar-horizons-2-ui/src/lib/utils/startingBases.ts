import {
    starSystemDefinition,
    startingBaseSystemIds,
    systemPopulation,
    type Faction,
    type HydratedStellarHorizonsGameState,
    type WorldPlacement
} from '@tabletop/stellar-horizons-2'

export interface StartingBaseOption {
    systemId: string
    habitability: number
    population: number
    worlds: WorldPlacement[]
    neighbours: Faction[]
}

export function startingBaseOptions(state: HydratedStellarHorizonsGameState): StartingBaseOption[] {
    return startingBaseSystemIds(state).map((systemId) => ({
        systemId,
        habitability: starSystemDefinition(systemId).habitability,
        population: systemPopulation(state, systemId),
        worlds: state.systemState(systemId).worlds,
        neighbours: state.bases
            .filter((base) => base.systemId === systemId)
            .flatMap((base) => state.getPlayerState(base.playerId).faction ?? [])
    }))
}
