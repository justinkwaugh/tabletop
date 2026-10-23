import {
    CargoPartnerKind,
    EARTH_STORAGE,
    cargoTransferLimits,
    countOf,
    freeCargo,
    blocksBases,
    goodsPartners,
    sameCargoPartner,
    shipDefinition,
    storageLimit,
    type CargoPartner,
    type HydratedStellarHorizonsGameState,
    type ShipState,
    type TradeGood
} from '@tabletop/stellar-horizons-2'
import type { CargoDraft } from '$lib/model/session.svelte.js'
import type { GoodsGroup } from './trade.js'

export interface GoodsTransferRow {
    good: TradeGood
    drafted: number
    onShip: number
    atPartner: number
    canLoad: boolean
    canUnload: boolean
}

export interface CargoTransferView {
    goods: GoodsTransferRow[]
    shipSettlements: number
    partnerSettlements?: number
    settlementCost?: number
    cost: number
    canLoad: boolean
    canUnload: boolean
    loadBlock?: string
    unloadBlock?: string
}

// What the transfer panel shows for a ship and its partner once the draft's settlements and
// goods have moved onto the ship (negative: off it).
export function cargoTransferView(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    draft: CargoDraft
): CargoTransferView {
    const { partner, settlements: drafted } = draft
    const limits = cargoTransferLimits(state, ship, partner)
    const canLoad = cargoDraftFits(state, ship, { ...draft, settlements: drafted + 1 })
    const canUnload = cargoDraftFits(state, ship, { ...draft, settlements: drafted - 1 })
    const partnerHeld = partnerSettlements(state, ship, partner)
    return {
        goods: goodsRows(state, ship, draft),
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

// A draft fits if each item keeps within its own limits and, together, the ship's hold, the
// partner ship's hold, Earth's storage or the base's storage.
export function cargoDraftFits(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    draft: CargoDraft
): boolean {
    const { partner } = draft
    const limits = cargoTransferLimits(state, ship, partner)
    if (draft.settlements > limits.load || -draft.settlements > limits.unload) {
        return false
    }
    // Each good keeps within what each side holds; room is checked for the whole draft below,
    // since the transfers run with everything coming off the ship first.
    const held = partnerGoods(state, ship, partner)
    const partnerTakesGoods =
        partner.kind !== CargoPartnerKind.Base || !blocksBases(state, ship.systemId)
    for (const move of draft.goods) {
        if (
            !goodsPartners(state, ship).some((candidate) => sameCargoPartner(candidate, partner)) ||
            move.count > countOf(held, move.good) ||
            -move.count > countOf(ship.goods, move.good) ||
            (move.count < 0 && !partnerTakesGoods)
        ) {
            return false
        }
    }
    const goodsOn = draft.goods.reduce((total, move) => total + move.count, 0)
    const onShip = draft.settlements + goodsOn
    if (onShip > freeCargo(state, ship)) {
        return false
    }
    switch (partner.kind) {
        case CargoPartnerKind.Ship: {
            const other = state.playerShip(ship.playerId, partner.shipId)
            return other !== undefined && -onShip <= freeCargo(state, other)
        }
        case CargoPartnerKind.Earth:
            return -goodsOn <= EARTH_STORAGE - state.getPlayerState(ship.playerId).earthGoods.length
        case CargoPartnerKind.Base: {
            const base = state.base(ship.playerId, ship.systemId)
            return (
                goodsOn >= 0 ||
                (base !== undefined && -goodsOn <= storageLimit(base) - base.goods.length)
            )
        }
    }
}

function partnerGoods(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    partner: CargoPartner
): TradeGood[] {
    switch (partner.kind) {
        case CargoPartnerKind.Earth:
            return state.getPlayerState(ship.playerId).earthGoods
        case CargoPartnerKind.Base:
            return state.base(ship.playerId, ship.systemId)?.goods ?? []
        case CargoPartnerKind.Ship:
            return state.playerShip(ship.playerId, partner.shipId)?.goods ?? []
    }
}

function goodsRows(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    draft: CargoDraft
): GoodsTransferRow[] {
    const held = partnerGoods(state, ship, draft.partner)
    const kinds = [...new Set([...ship.goods, ...held])]
    return kinds.map((good) => {
        const drafted = draft.goods.find((move) => move.good === good)?.count ?? 0
        const withChange = (change: number): CargoDraft => ({
            ...draft,
            goods: [
                ...draft.goods.filter((move) => move.good !== good),
                { good, count: drafted + change }
            ]
        })
        return {
            good,
            drafted,
            onShip: countOf(ship.goods, good) + drafted,
            atPartner: countOf(held, good) - drafted,
            canLoad: cargoDraftFits(state, ship, withChange(1)),
            canUnload: cargoDraftFits(state, ship, withChange(-1))
        }
    })
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

// A hold's goods once the draft's moves land: `direction` 1 for the chosen ship, -1 for its
// partner ship.
export function goodsAfterMoves(
    goods: readonly TradeGood[],
    moves: readonly GoodsGroup[],
    direction: 1 | -1
): TradeGood[] {
    const result = [...goods]
    for (const move of moves) {
        const count = move.count * direction
        for (let index = 0; index < Math.abs(count); index++) {
            if (count > 0) {
                result.push(move.good)
            } else {
                result.splice(result.lastIndexOf(move.good), 1)
            }
        }
    }
    return result
}
