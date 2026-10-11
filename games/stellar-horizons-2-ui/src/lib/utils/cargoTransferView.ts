import {
    CargoPartnerKind,
    cargoTransferLimits,
    freeCargo,
    shipDefinition,
    type CargoPartner,
    type HydratedStellarHorizonsGameState,
    type ShipState
} from '@tabletop/stellar-horizons-2'

export interface CargoTransferView {
    shipSettlements: number
    partnerSettlements?: number
    settlementCost?: number
    cost: number
    canLoad: boolean
    canUnload: boolean
    loadBlock?: string
    unloadBlock?: string
}

// What the transfer panel shows for a ship and its partner once `drafted` settlements have
// moved onto the ship (negative: off it).
export function cargoTransferView(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    partner: CargoPartner,
    drafted: number
): CargoTransferView {
    const limits = cargoTransferLimits(state, ship, partner)
    const canLoad = drafted < limits.load
    const canUnload = -drafted < limits.unload
    const partnerHeld = partnerSettlements(state, ship, partner)
    return {
        shipSettlements: ship.settlements + drafted,
        partnerSettlements: partnerHeld === undefined ? undefined : partnerHeld - drafted,
        settlementCost: partner.kind === CargoPartnerKind.Earth ? limits.settlementCost : undefined,
        cost: Math.max(0, drafted) * limits.settlementCost,
        canLoad,
        canUnload,
        loadBlock: canLoad ? undefined : loadBlock(state, ship, partner, drafted),
        unloadBlock: canUnload ? undefined : unloadBlock(state, ship, partner, drafted)
    }
}

function partnerSettlements(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    partner: CargoPartner
): number | undefined {
    switch (partner.kind) {
        case CargoPartnerKind.Earth:
            return undefined
        case CargoPartnerKind.Base:
            return state.base(ship.playerId, ship.systemId)?.settlements ?? 0
        case CargoPartnerKind.Ship:
            return state.playerShip(ship.playerId, partner.shipId)?.settlements ?? 0
    }
}

function loadBlock(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    partner: CargoPartner,
    drafted: number
): string {
    if (freeCargo(state, ship) - drafted <= 0) {
        return 'The hold is full'
    }
    switch (partner.kind) {
        case CargoPartnerKind.Earth:
            return 'Not enough cash'
        case CargoPartnerKind.Base:
            return (partnerSettlements(state, ship, partner) ?? 0) - drafted <= 0
                ? 'No settlements at the base'
                : 'A ship loads at most 1 settlement from a base each turn'
        case CargoPartnerKind.Ship:
            return `None on ${shipDefinition(partner.shipId).name}`
    }
}

function unloadBlock(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    partner: CargoPartner,
    drafted: number
): string {
    if (partner.kind === CargoPartnerKind.Earth) {
        return 'Settlements cannot be left at Earth'
    }
    if (ship.settlements + drafted <= 0) {
        return 'None aboard'
    }
    return partner.kind === CargoPartnerKind.Base
        ? 'You cannot settle here'
        : `${shipDefinition(partner.shipId).name}'s hold is full`
}
