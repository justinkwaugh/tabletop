import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { SOL_SYSTEM_ID } from '../components/systems.js'
import { capabilitiesOf, cargoCapacity, freeCargo, hasArrived } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type { ShipState } from './pieces.js'
import {
    addSettlements,
    canLoadFromBase,
    canSettleSystem,
    canUnload,
    removeBaseSettlement,
    settlementPurchaseLimit
} from './settling.js'
import { TurnStep } from './turn.js'

export enum CargoPartnerKind {
    Earth = 'Earth',
    Base = 'Base',
    Ship = 'Ship'
}

export type CargoPartner = Type.Static<typeof CargoPartner>
export const CargoPartner = Type.Union([
    Type.Object({ kind: Type.Literal(CargoPartnerKind.Earth) }),
    Type.Object({ kind: Type.Literal(CargoPartnerKind.Base) }),
    Type.Object({ kind: Type.Literal(CargoPartnerKind.Ship), shipId: Type.String() })
])

export type CargoTransferResult = Type.Static<typeof CargoTransferResult>
export const CargoTransferResult = Type.Object({
    systemId: Type.String(),
    cost: Type.Number(),
    foundedBase: Type.Optional(Type.Boolean()),
    baseSettlements: Type.Optional(Type.Number())
})

export interface CargoTransferLimits {
    load: number
    unload: number
    settlementCost: number
}

export function sameCargoPartner(a: CargoPartner, b: CargoPartner): boolean {
    return (
        a.kind === b.kind &&
        (a.kind !== CargoPartnerKind.Ship ||
            b.kind !== CargoPartnerKind.Ship ||
            a.shipId === b.shipId)
    )
}

export function carriesCargo(state: HydratedStellarHorizonsGameState, ship: ShipState): boolean {
    return cargoCapacity(state, ship) > 0 || ship.settlements > 0
}

// Rule 1.8: settlements move between a player's ships at any time in their turn; buying,
// loading from a base and unloading belong to the cargo step.
export function cargoPartners(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState
): CargoPartner[] {
    const step = state.getPlayerState(ship.playerId).step
    if (!hasArrived(ship) || step === TurnStep.Done) {
        return []
    }
    const ships: CargoPartner[] = state
        .shipsOf(ship.playerId)
        .filter(
            (other) =>
                other.shipId !== ship.shipId &&
                other.systemId === ship.systemId &&
                hasArrived(other) &&
                carriesCargo(state, other)
        )
        .map((other) => ({ kind: CargoPartnerKind.Ship, shipId: other.shipId }))
    if (step !== TurnStep.Cargo) {
        return ships
    }
    const places: CargoPartner[] = []
    if (ship.systemId === SOL_SYSTEM_ID && capabilitiesOf(state, ship.playerId).canBuySettlements) {
        places.push({ kind: CargoPartnerKind.Earth })
    }
    if (
        state.base(ship.playerId, ship.systemId) !== undefined ||
        canSettleSystem(state, ship.playerId, ship.systemId)
    ) {
        places.push({ kind: CargoPartnerKind.Base })
    }
    return [...places, ...ships]
}

export function cargoTransferLimits(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    partner: CargoPartner
): CargoTransferLimits {
    switch (partner.kind) {
        case CargoPartnerKind.Earth:
            return {
                load: settlementPurchaseLimit(state, ship),
                unload: 0,
                settlementCost: capabilitiesOf(state, ship.playerId).settlementCost
            }
        case CargoPartnerKind.Base:
            return {
                load: canLoadFromBase(state, ship) ? 1 : 0,
                unload: canUnload(state, ship) ? ship.settlements : 0,
                settlementCost: 0
            }
        case CargoPartnerKind.Ship: {
            const other = partnerShip(state, ship, partner.shipId)
            return {
                load: Math.min(other.settlements, freeCargo(state, ship)),
                unload: Math.min(ship.settlements, freeCargo(state, other)),
                settlementCost: 0
            }
        }
    }
}

export function canTransferAnyCargo(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): boolean {
    return state.shipsOf(playerId).some((ship) =>
        cargoPartners(state, ship).some((partner) => {
            const limits = cargoTransferLimits(state, ship, partner)
            return limits.load > 0 || limits.unload > 0
        })
    )
}

// `settlements` counts settlements moving onto the ship; a negative number moves them off it.
export function transferCargo(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    partner: CargoPartner,
    settlements: number
): CargoTransferResult {
    const systemId = ship.systemId
    switch (partner.kind) {
        case CargoPartnerKind.Earth: {
            const cost = settlements * capabilitiesOf(state, ship.playerId).settlementCost
            state.getPlayerState(ship.playerId).cash -= cost
            ship.settlements += settlements
            return { systemId, cost }
        }
        case CargoPartnerKind.Base: {
            if (settlements > 0) {
                removeBaseSettlement(state, ship.playerId, systemId)
                ship.settlements += 1
                ship.loadedFromBase = true
                return { systemId, cost: 0 }
            }
            const foundedBase = state.base(ship.playerId, systemId) === undefined
            ship.settlements += settlements
            addSettlements(state, ship.playerId, systemId, -settlements)
            const base = state.base(ship.playerId, systemId)
            assertExists(base, 'Unloading settlements must leave a base')
            return { systemId, cost: 0, foundedBase, baseSettlements: base.settlements }
        }
        case CargoPartnerKind.Ship: {
            const other = partnerShip(state, ship, partner.shipId)
            other.settlements -= settlements
            ship.settlements += settlements
            return { systemId, cost: 0 }
        }
    }
}

function partnerShip(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    shipId: string
): ShipState {
    const other = state.playerShip(ship.playerId, shipId)
    assertExists(other, `Ship ${shipId} is not one of the player's ships`)
    return other
}
