import { ShipKind, shipDefinition, type ShipDefinition } from '../components/ships.js'
import { TechField } from '../components/techFields.js'
import { playerCapabilities, type Capabilities } from './capabilities.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type { CompensationMarkers } from './exploration.js'
import type { ShipState } from './pieces.js'
import { awardTechMarkers } from './pools.js'
import { roundHalfUp } from './turn.js'

export interface ShipLoss {
    shipId: string
    settlementsLost: number
    compensation: CompensationMarkers
}

export function capabilitiesOf(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): Capabilities {
    return playerCapabilities(state.getPlayerState(playerId), state.scenarioDefinition())
}

export function cargoCapacity(state: HydratedStellarHorizonsGameState, ship: ShipState): number {
    const definition = shipDefinition(ship.shipId)
    if (definition.cargo === 0) {
        return 0
    }
    return definition.cargo + capabilitiesOf(state, ship.playerId).cargoBonus
}

export function freeCargo(state: HydratedStellarHorizonsGameState, ship: ShipState): number {
    return cargoCapacity(state, ship) - ship.settlements
}

export function hasArrived(ship: ShipState): boolean {
    return ship.transit === 0
}

export function crippledThreshold(definition: ShipDefinition): number {
    return roundHalfUp(definition.size / 2)
}

export function isCrippled(ship: ShipState): boolean {
    const definition = shipDefinition(ship.shipId)
    return definition.kind === ShipKind.CV && ship.damage >= crippledThreshold(definition)
}

export function currentExploration(ship: ShipState): number {
    return Math.max(1, shipDefinition(ship.shipId).exploration - ship.damage)
}

export function removeShip(state: HydratedStellarHorizonsGameState, shipId: string) {
    state.ships = state.ships.filter((ship) => ship.shipId !== shipId)
}

export function loseShip(state: HydratedStellarHorizonsGameState, ship: ShipState): ShipLoss {
    const definition = shipDefinition(ship.shipId)
    const compensation: CompensationMarkers = {}
    const award = (field: TechField.Biology | TechField.Engineering, count: number) => {
        const { markers, cash } = awardTechMarkers(state, ship.playerId, field, count)
        compensation[field] = markers
        if (cash > 0) {
            compensation.cash = (compensation.cash ?? 0) + cash
        }
    }
    if (definition.kind === ShipKind.RE) {
        award(TechField.Engineering, 1)
    } else {
        award(TechField.Biology, 1)
        award(TechField.Engineering, roundHalfUp(definition.size / 4))
    }
    removeShip(state, ship.shipId)
    return { shipId: ship.shipId, settlementsLost: ship.settlements, compensation }
}
