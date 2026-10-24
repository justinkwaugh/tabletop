import * as Type from 'typebox'
import { isCrewVehicle, shipDefinition, ShipKind } from '../components/ships.js'
import { blocksExploration } from './anomalies.js'
import { starSystemDefinition } from '../components/systems.js'
import { TechField } from '../components/techFields.js'
import {
    capabilitiesOf,
    crippledThreshold,
    currentExploration,
    damageCapacity,
    hasArrived,
    isCrippled,
    loseShip
} from './fleet.js'
import { isHeld } from './holds.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { MarkerReason, type ShipState } from './pieces.js'
import { earnMarkers } from './pools.js'

export const SEVERE_MALFUNCTION_ROLL = 10
export const EXPLORATION_STEP = 10

export type CompensationCounts = Type.Static<typeof CompensationCounts>
export const CompensationCounts = Type.Object({
    [TechField.Biology]: Type.Optional(Type.Number()),
    [TechField.Engineering]: Type.Optional(Type.Number())
})

export type ExplorationResult = Type.Static<typeof ExplorationResult>
export const ExplorationResult = Type.Object({
    systemId: Type.String(),
    field: Type.Enum(TechField),
    explorationValue: Type.Number(),
    rewardRoll: Type.Optional(Type.Number()),
    rewardRolls: Type.Optional(Type.Array(Type.Number())),
    markerCount: Type.Number(),
    malfunctionRate: Type.Number(),
    malfunctionRoll: Type.Number(),
    damage: Type.Number(),
    destroyed: Type.Boolean(),
    crippled: Type.Boolean(),
    settlementsLost: Type.Number(),
    compensation: CompensationCounts
})

export function surveyThreshold(playerCount: number): number {
    if (playerCount <= 1) {
        return 2
    }
    if (playerCount <= 3) {
        return 3
    }
    if (playerCount <= 5) {
        return 4
    }
    return 5
}

export function canExplore(state: HydratedStellarHorizonsGameState, ship: ShipState): boolean {
    return (
        hasArrived(ship) &&
        !ship.explored &&
        !isHeld(state, ship) &&
        !isCrippled(state, ship) &&
        state.systemState(ship.systemId).explorationMarker > 0 &&
        !blocksExploration(state, ship.systemId)
    )
}

export function canExploreAnyShip(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): boolean {
    return state.shipsOf(playerId).some((ship) => canExplore(state, ship))
}

export function explorationValue(state: HydratedStellarHorizonsGameState, ship: ShipState): number {
    const definition = shipDefinition(ship.shipId)
    const capabilities = capabilitiesOf(state, ship.playerId)
    const techBonus = isCrewVehicle(definition)
        ? capabilities.cvExplorationBonus
        : capabilities.reExplorationBonus
    return (
        state.systemState(ship.systemId).explorationMarker +
        currentExploration(ship) +
        techBonus +
        starSystemDefinition(ship.systemId).exploration.bonus
    )
}

export function explorationDice(state: HydratedStellarHorizonsGameState, ship: ShipState) {
    const capabilities = capabilitiesOf(state, ship.playerId)
    return isCrewVehicle(shipDefinition(ship.shipId))
        ? capabilities.cvExplorationDice
        : capabilities.reExplorationDice
}

export function malfunctionRate(state: HydratedStellarHorizonsGameState, ship: ShipState) {
    const capabilities = capabilitiesOf(state, ship.playerId)
    return isCrewVehicle(shipDefinition(ship.shipId))
        ? capabilities.cvMalfunction
        : capabilities.reMalfunction
}

// The markers are drawn once every player has explored; the exploration only records how many.
export function explore(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState
): ExplorationResult {
    const definition = shipDefinition(ship.shipId)
    const field = starSystemDefinition(ship.systemId).exploration.field
    const value = explorationValue(state, ship)
    const random = state.getPlayerPrng(ship.playerId)
    const remainder = value % EXPLORATION_STEP
    // Explorer's Guild and Quantum Sensors roll two dice; the lower is always the better.
    const rewardRolls =
        remainder > 0
            ? Array.from({ length: explorationDice(state, ship) }, () => random.dieRoll(10))
            : []
    const rewardRoll = rewardRolls.length > 0 ? Math.min(...rewardRolls) : undefined
    const rate = malfunctionRate(state, ship)
    const malfunctionRoll = random.dieRoll(100)
    const markerCount =
        Math.floor(value / EXPLORATION_STEP) +
        (rewardRoll !== undefined && rewardRoll <= remainder ? 1 : 0)
    earnMarkers(state, ship.playerId, {
        shipId: ship.shipId,
        systemId: ship.systemId,
        field,
        count: markerCount,
        reason: MarkerReason.Exploration
    })
    ship.explored = true

    const result: ExplorationResult = {
        systemId: ship.systemId,
        field,
        explorationValue: value,
        rewardRoll,
        ...(rewardRolls.length > 1 ? { rewardRolls } : {}),
        markerCount,
        malfunctionRate: rate,
        malfunctionRoll,
        damage: 0,
        destroyed: false,
        crippled: false,
        settlementsLost: 0,
        compensation: {}
    }

    if (malfunctionRoll > rate) {
        return result
    }
    if (definition.kind === ShipKind.RE) {
        const loss = loseShip(state, ship)
        return { ...result, destroyed: true, compensation: loss.compensation }
    }
    const damage = malfunctionRoll <= SEVERE_MALFUNCTION_ROLL ? 2 : 1
    ship.damage += damage
    if (ship.damage >= damageCapacity(state, ship)) {
        const loss = loseShip(state, ship)
        return {
            ...result,
            damage,
            destroyed: true,
            settlementsLost: loss.settlementsLost,
            compensation: loss.compensation
        }
    }
    return { ...result, damage, crippled: ship.damage >= crippledThreshold(state, ship) }
}
