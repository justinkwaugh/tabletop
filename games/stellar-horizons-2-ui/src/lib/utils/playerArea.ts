import {
    AnomalyChallenge,
    MachineState,
    ShipKind,
    TECHS,
    TECH_FIELDS,
    VictoryKind,
    settlementVictory,
    shipDefinition,
    systemPopulation,
    techDefinition,
    type AnomalyVictory,
    type Faction,
    type HydratedStellarHorizonsGameState,
    type HydratedStellarHorizonsPlayerState,
    type SettlementVictory,
    type ShipState,
    type TechField,
    type TurnStep
} from '@tabletop/stellar-horizons-2'

// Progress in a scenario won by resolving anomalies.
export interface AnomalyTally {
    science: number
    combat: number
    goal: AnomalyVictory
}

// One row of the standings: who a player is and the counts worth comparing at a glance.
export interface Standing {
    playerId: string
    faction?: Faction
    initiative: number
    step?: TurnStep
    explorers: number
    crewVehicles: number
    settlements: number
    cash: number
    anomalies?: AnomalyTally
}

export interface ConsoleBase {
    systemId: string
    settlements: number
    population: number
}

// Ships are listed under the system they are at, or are travelling to.
export interface ConsoleShipGroup {
    systemId: string
    ships: ShipState[]
}

export interface FieldProgress {
    field: TechField
    developed: number
    total: number
    developedThisTurn: boolean
}

// Everything the console shows about one player.
export interface FactionConsoleView {
    standing: Standing
    markers: Record<TechField, number[]>
    bases: ConsoleBase[]
    anomalyIds: string[]
    settlementGoal?: SettlementVictory
    fleet: ConsoleShipGroup[]
    techs: FieldProgress[]
}

export function standings(state: HydratedStellarHorizonsGameState): Standing[] {
    return state.initiativeOrder().map((playerId, index) => {
        const player = state.getPlayerState(playerId)
        const ships = state.shipsOf(playerId)
        const explorers = ships.filter(
            (ship) => shipDefinition(ship.shipId).kind === ShipKind.RE
        ).length
        return {
            playerId,
            faction: player.faction,
            initiative: index + 1,
            step: state.machineState === MachineState.PlayingTurn ? player.step : undefined,
            explorers,
            crewVehicles: ships.length - explorers,
            settlements: state
                .basesOf(playerId)
                .reduce((total, base) => total + base.settlements, 0),
            cash: player.cash,
            anomalies: anomalyTally(state, player)
        }
    })
}

function anomalyTally(
    state: HydratedStellarHorizonsGameState,
    player: HydratedStellarHorizonsPlayerState
): AnomalyTally | undefined {
    const goal = state.scenarioDefinition().victory
    return goal.kind === VictoryKind.Anomalies
        ? {
              science: player.anomaliesResolved(AnomalyChallenge.Science),
              combat: player.anomaliesResolved(AnomalyChallenge.Combat),
              goal
          }
        : undefined
}

export function factionConsole(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): FactionConsoleView | undefined {
    const standing = standings(state).find((candidate) => candidate.playerId === playerId)
    if (!standing) {
        return undefined
    }
    const player = state.getPlayerState(playerId)
    const scenario = state.scenarioDefinition()
    const owned = player.techs.map((tech) => techDefinition(tech.techId).field)
    return {
        standing,
        markers: player.techMarkers,
        bases: state
            .basesOf(playerId)
            .map((base) => ({
                systemId: base.systemId,
                settlements: base.settlements,
                population: systemPopulation(state, base.systemId)
            }))
            .toSorted((a, b) => b.settlements - a.settlements),
        anomalyIds: player.anomalies,
        settlementGoal: settlementVictory(scenario),
        fleet: fleet(state, playerId),
        techs: TECH_FIELDS.map((field) => ({
            field,
            developed: owned.filter((candidate) => candidate === field).length,
            total: TECHS.filter((tech) => tech.field === field).length,
            developedThisTurn: player.fieldsDeveloped.includes(field)
        }))
    }
}

function fleet(state: HydratedStellarHorizonsGameState, playerId: string): ConsoleShipGroup[] {
    const ships = state.shipsOf(playerId)
    return state.systems
        .map((system) => ({
            systemId: system.systemId,
            ships: ships
                .filter((ship) => ship.systemId === system.systemId)
                .toSorted((a, b) => a.transit - b.transit)
        }))
        .filter((group) => group.ships.length > 0)
}
