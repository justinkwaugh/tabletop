import * as Type from 'typebox'
import { ShipKind, shipDefinition } from '../components/ships.js'
import { starSystemDefinition } from '../components/systems.js'
import { TechField } from '../components/techFields.js'
import {
    capabilitiesOf,
    crippledThreshold,
    currentExploration,
    hasArrived,
    isCrippled,
    loseShip
} from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type { ShipState } from './pieces.js'
import { drawTechMarkers } from './pools.js'

export const SEVERE_MALFUNCTION_ROLL = 10
export const EXPLORATION_STEP = 10

export type CompensationMarkers = Type.Static<typeof CompensationMarkers>
export const CompensationMarkers = Type.Object({
    [TechField.Biology]: Type.Optional(Type.Array(Type.Number())),
    [TechField.Engineering]: Type.Optional(Type.Array(Type.Number()))
})

export type ExplorationResult = Type.Static<typeof ExplorationResult>
export const ExplorationResult = Type.Object({
    systemId: Type.String(),
    field: Type.Enum(TechField),
    explorationValue: Type.Number(),
    rewardRoll: Type.Optional(Type.Number()),
    markers: Type.Array(Type.Number()),
    malfunctionRate: Type.Number(),
    malfunctionRoll: Type.Number(),
    damage: Type.Number(),
    destroyed: Type.Boolean(),
    crippled: Type.Boolean(),
    settlementsLost: Type.Number(),
    compensation: CompensationMarkers,
    survey: Type.Boolean()
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
        !isCrippled(ship) &&
        state.systemState(ship.systemId).explorationMarker > 0
    )
}

export function explorationValue(state: HydratedStellarHorizonsGameState, ship: ShipState): number {
    const definition = shipDefinition(ship.shipId)
    const capabilities = capabilitiesOf(state, ship.playerId)
    const techBonus =
        definition.kind === ShipKind.CV
            ? capabilities.cvExplorationBonus
            : capabilities.reExplorationBonus
    return (
        state.systemState(ship.systemId).explorationMarker +
        currentExploration(ship) +
        techBonus +
        starSystemDefinition(ship.systemId).exploration.bonus
    )
}

export function malfunctionRate(state: HydratedStellarHorizonsGameState, ship: ShipState) {
    const capabilities = capabilitiesOf(state, ship.playerId)
    return shipDefinition(ship.shipId).kind === ShipKind.CV
        ? capabilities.cvMalfunction
        : capabilities.reMalfunction
}

export function explore(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState
): ExplorationResult {
    const definition = shipDefinition(ship.shipId)
    const field = starSystemDefinition(ship.systemId).exploration.field
    const value = explorationValue(state, ship)
    const random = state.getProtectedPrng()
    const remainder = value % EXPLORATION_STEP
    const rewardRoll = remainder > 0 ? random.dieRoll(10) : undefined
    const rate = malfunctionRate(state, ship)
    const malfunctionRoll = random.dieRoll(100)
    const markerCount =
        Math.floor(value / EXPLORATION_STEP) +
        (rewardRoll !== undefined && rewardRoll <= remainder ? 1 : 0)
    const markers = drawTechMarkers(state, field, markerCount)
    state.getPlayerState(ship.playerId).techMarkers[field].push(...markers)
    ship.explored = true

    const surveyTotal = markers.reduce((total, marker) => total + marker, 0)
    const result: ExplorationResult = {
        systemId: ship.systemId,
        field,
        explorationValue: value,
        rewardRoll,
        markers,
        malfunctionRate: rate,
        malfunctionRoll,
        damage: 0,
        destroyed: false,
        crippled: false,
        settlementsLost: 0,
        compensation: {},
        survey: surveyTotal >= surveyThreshold(state.numPlayers)
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
    if (ship.damage >= definition.size) {
        const loss = loseShip(state, ship)
        return {
            ...result,
            damage,
            destroyed: true,
            settlementsLost: loss.settlementsLost,
            compensation: loss.compensation
        }
    }
    return { ...result, damage, crippled: ship.damage >= crippledThreshold(definition) }
}
