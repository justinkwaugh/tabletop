import { SOL_SYSTEM_ID, systemDistance } from '../components/systems.js'
import { ShipKind, shipDefinition } from '../components/ships.js'
import { fastMovementModifier } from './capabilities.js'
import { capabilitiesOf, hasArrived } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type { ShipState } from './pieces.js'
import { TurnStep, nextTurnStep } from './turn.js'

export interface MoveOption {
    systemId: string
    turns: number
}

export function shipRange(state: HydratedStellarHorizonsGameState, ship: ShipState): number {
    const capabilities = capabilitiesOf(state, ship.playerId)
    return shipDefinition(ship.shipId).kind === ShipKind.CV
        ? capabilities.cvRange
        : capabilities.reRange
}

export function movementModifier(state: HydratedStellarHorizonsGameState, ship: ShipState) {
    const definition = shipDefinition(ship.shipId)
    const capabilities = capabilitiesOf(state, ship.playerId)
    if (definition.kind === ShipKind.RE) {
        return capabilities.reMovement
    }
    if (definition.fast && ship.settlements === 0) {
        return fastMovementModifier(capabilities.cvMovement)
    }
    return capabilities.cvMovement
}

export function isWithinRange(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    systemId: string
): boolean {
    const range = shipRange(state, ship)
    const cost = shipDefinition(ship.shipId).cost
    const anchors = [
        SOL_SYSTEM_ID,
        ...state
            .basesOf(ship.playerId)
            .filter((base) => base.settlements >= cost)
            .map((base) => base.systemId)
    ]
    return anchors.some((anchor) => systemDistance(anchor, systemId) <= range)
}

export function travelTime(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    systemId: string
): number {
    const hexes = systemDistance(ship.systemId, systemId)
    return Math.max(1, Math.ceil(hexes * movementModifier(state, ship)))
}

export function moveOptions(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState
): MoveOption[] {
    if (!hasArrived(ship)) {
        return []
    }
    return state.systems
        .map((system) => system.systemId)
        .filter((systemId) => systemId !== ship.systemId && isWithinRange(state, ship, systemId))
        .map((systemId) => ({ systemId, turns: travelTime(state, ship, systemId) }))
}

export function canMoveAnyShip(state: HydratedStellarHorizonsGameState, playerId: string): boolean {
    return state.shipsOf(playerId).some((ship) => moveOptions(state, ship).length > 0)
}

// A movement step with nothing left to move ends by itself.
export function endIdleMovement(state: HydratedStellarHorizonsGameState, playerId: string) {
    const player = state.getPlayerState(playerId)
    if (player.step === TurnStep.Movement && !canMoveAnyShip(state, playerId)) {
        player.step = nextTurnStep(player.step)
    }
}
