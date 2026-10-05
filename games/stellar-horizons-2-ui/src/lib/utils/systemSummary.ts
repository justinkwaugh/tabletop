import {
    FACTIONS,
    systemDefinition,
    type Faction,
    type HydratedStellarHorizonsGameState,
    type ShipState
} from '@tabletop/stellar-horizons-2'

export interface FleetSummary {
    playerId: string
    faction?: Faction
    settlements: number
    ships: ShipState[]
}

export interface SystemSummary {
    name: string
    settlementGoal: number
    fleets: FleetSummary[]
}

export function systemSummary(
    state: HydratedStellarHorizonsGameState,
    systemId: string,
    viewerId: string | undefined
): SystemSummary {
    return {
        name: systemDefinition(systemId).name,
        settlementGoal: state.scenarioDefinition().victorySettlements,
        fleets: fleets(state, systemId, viewerId)
    }
}

function fleets(
    state: HydratedStellarHorizonsGameState,
    systemId: string,
    viewerId: string | undefined
): FleetSummary[] {
    const present = state.players.filter(
        (player) =>
            state.ships.some(
                (ship) => ship.systemId === systemId && ship.playerId === player.playerId
            ) || state.base(player.playerId, systemId) !== undefined
    )
    const order = (playerId: string, faction?: Faction) =>
        playerId === viewerId
            ? -1
            : faction
              ? FACTIONS.findIndex((candidate) => candidate.faction === faction)
              : FACTIONS.length
    return present
        .toSorted((a, b) => order(a.playerId, a.faction) - order(b.playerId, b.faction))
        .map((player) => ({
            playerId: player.playerId,
            faction: player.faction,
            settlements: state.base(player.playerId, systemId)?.settlements ?? 0,
            ships: state.ships.filter(
                (ship) => ship.systemId === systemId && ship.playerId === player.playerId
            )
        }))
}
