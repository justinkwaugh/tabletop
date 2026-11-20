import { ActionSource, assert } from '@tabletop/common'
import {
    actsFor,
    closePrivate,
    stepAction,
    titleAction,
    type TrackLayDetails
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { GhostTownId, JewelerId, NuggetId } from './ids.js'
import { GoldMines } from './map.js'
import { ownsOpenPrivate, privatePlayerHolder } from './privateHoldings.js'
import { operatedBy } from './operator.js'
import { requireStateRoyalGorge, type GoldShipment, type HydratedStateRoyalGorge } from './state.js'
import { colorPhase } from './trains.js'

/** What VGC pays at the end of a set, by how much gold covers its track (GO-4). */
export const GoldDividends: readonly number[] = [50, 90, 140, 200, 270, 350]
/** The gold track's spaces each colour phase opens; the red space is never covered (GO-3). */
const ShipmentLimits = { Yellow: 2, Green: 4, Brown: 5, Silver: 5 } as const
export const GoldBonus = 50
export const NuggetBonus = 130
export const GhostTownBonus = 10
export const GhostTownCount = 4
/** What the Local Jeweler gains for each shipment (Y6). */
export const JewelerShare = 5

export function goldDividend(state: object): number {
    const dividend = GoldDividends[requireStateRoyalGorge(state).goldShipped]
    assert(dividend !== undefined, 'The gold track has a value for its shipments')
    return dividend
}

export function goldShipmentLimit(phaseId: string): number {
    return ShipmentLimits[colorPhase(phaseId)]
}

/** A yellow tile on a mine hex brings a gold cube for each mine printed there (GO-1). */
export function placeGold(state: object, details: TrackLayDetails): void {
    const mines = GoldMines[details.locationId]
    if (!mines || details.previous) return
    const title = requireStateRoyalGorge(state)
    title.goldCubes = {
        ...title.goldCubes,
        [details.locationId]: (title.goldCubes[details.locationId] ?? 0) + mines
    }
}

/** The hexes whose track the company's run uses, where gold may be shipped from (GO-2). */
function runHexes(state: HydratedStateRoyalGorge, companyId: string): Set<string> {
    const result = state.routeStep?.companyId === companyId ? state.routeStep.result : undefined
    return new Set(
        (result?.routes ?? []).flatMap((route) => route.paths.map((path) => path.locationId))
    )
}

/** The gold the operating company may ship now, by hex: one a turn while the track has room. */
export function shippableGold(state: object, companyId: string): string[] {
    const title = requireStateRoyalGorge(state)
    if (
        title.goldShipment ||
        title.earningsDistribution ||
        title.routeStep?.companyId !== companyId ||
        !title.routeStep.result ||
        title.goldShipped >= goldShipmentLimit(title.phaseId)
    )
        return []
    const hexes = runHexes(title, companyId)
    return Object.keys(title.goldCubes).filter((locationId) => hexes.has(locationId))
}

/** What a shipment adds to the revenue: $50, or $130 with the 13lb Gold Nugget (GO-2, G2). */
export function shipmentBonus(shipment: Pick<GoldShipment, 'nugget'>): number {
    return shipment.nugget ? NuggetBonus : GoldBonus
}

/** The gold added to the company's revenue this turn (Calculating Revenue). */
export function shippedGoldRevenue(state: object, companyId: string): number {
    const shipment = requireStateRoyalGorge(state).goldShipment
    return shipment?.companyId === companyId ? shipmentBonus(shipment) : 0
}

const ShipGoldAction = titleAction('ShipGold', {
    companyId: Type.String({ minLength: 1 }),
    locationId: Type.String({ minLength: 1 }),
    /** The 13lb Gold Nugget ships it, for $130 (G2). */
    nugget: Type.Optional(Type.Literal(true))
})
export const ShipGold = ShipGoldAction.schema
export type ShipGold = Type.Static<typeof ShipGold>
export const isShipGold = ShipGoldAction.is

/**
 * The operating company ships a gold cube from a hex its run used, adding $50 to its revenue,
 * or $130 with the Gold Nugget, which then closes; the Local Jeweler gains $5 (GO-3, G2, Y6).
 */
export class HydratedShipGold extends ShipGoldAction.Base {
    declare playerId: string
    declare companyId: string
    declare locationId: string
    declare nugget?: true
    isValid(state: HydratedStateRoyalGorge): boolean {
        return (
            this.source === ActionSource.User &&
            actsFor(state, this.playerId, this.companyId) &&
            shippableGold(state, this.companyId).includes(this.locationId) &&
            (!this.nugget || ownsOpenPrivate(state, this.companyId, NuggetId))
        )
    }
    apply(state: HydratedStateRoyalGorge): void {
        assert(this.isValid(state), 'This gold cannot be shipped now')
        const left = (state.goldCubes[this.locationId] ?? 0) - 1
        const { [this.locationId]: _shipped, ...others } = state.goldCubes
        state.goldCubes = left > 0 ? { ...others, [this.locationId]: left } : others
        state.goldShipped += 1
        state.goldShipment = {
            companyId: this.companyId,
            locationId: this.locationId,
            ...(this.nugget ? { nugget: true as const } : {})
        }
        if (privatePlayerHolder(state, JewelerId)) state.jewelerCash += JewelerShare
        if (this.nugget) closePrivate(state, NuggetId)
    }
}

/** Where the operating company may place a ghost town: the mine it just emptied (Y2). */
export function ghostTownSite(state: object, companyId: string): string | undefined {
    const title = requireStateRoyalGorge(state)
    const shipment = title.goldShipment
    if (
        shipment?.companyId !== companyId ||
        title.goldCubes[shipment.locationId] ||
        title.ghostTowns.includes(shipment.locationId) ||
        title.ghostTowns.length >= GhostTownCount ||
        !ownsOpenPrivate(title, companyId, GhostTownId)
    )
        return undefined
    return shipment.locationId
}

const PlaceGhostTownAction = titleAction('PlaceGhostTown', {
    companyId: Type.String({ minLength: 1 }),
    locationId: Type.String({ minLength: 1 })
})
export const PlaceGhostTown = PlaceGhostTownAction.schema
export type PlaceGhostTown = Type.Static<typeof PlaceGhostTown>
export const isPlaceGhostTown = PlaceGhostTownAction.is

/** The Ghost Town Tour Co.'s railroad leaves a ghost town where it shipped a mine's last gold. */
export class HydratedPlaceGhostTown extends PlaceGhostTownAction.Base {
    declare playerId: string
    declare companyId: string
    declare locationId: string
    isValid(state: HydratedStateRoyalGorge): boolean {
        return (
            this.source === ActionSource.User &&
            actsFor(state, this.playerId, this.companyId) &&
            ghostTownSite(state, this.companyId) === this.locationId
        )
    }
    apply(state: HydratedStateRoyalGorge): void {
        assert(this.isValid(state), 'No ghost town may be placed here')
        state.ghostTowns = [...state.ghostTowns, this.locationId]
    }
}

/** A railroad's route earns $10 for each ghost town it runs through, its owner's alone (Y2). */
export function ghostTownBonus(state: object, locationId: string, companyId: string): number {
    const title = requireStateRoyalGorge(state)
    return title.ghostTowns.includes(locationId) && ownsOpenPrivate(title, companyId, GhostTownId)
        ? GhostTownBonus
        : 0
}

export const GoldSteps = [
    stepAction<HydratedStateRoyalGorge, HydratedShipGold>(
        ShipGoldAction.type,
        (action): action is HydratedShipGold => action instanceof HydratedShipGold,
        (state, playerId) => {
            const companyId = operatedBy(state, playerId)
            return !!companyId && shippableGold(state, companyId).length > 0
        }
    ),
    stepAction<HydratedStateRoyalGorge, HydratedPlaceGhostTown>(
        PlaceGhostTownAction.type,
        (action): action is HydratedPlaceGhostTown => action instanceof HydratedPlaceGhostTown,
        (state, playerId) => {
            const companyId = operatedBy(state, playerId)
            return !!companyId && !!ghostTownSite(state, companyId)
        }
    )
]

export const GoldActions = [
    ShipGoldAction.define((action) => new HydratedShipGold(action)),
    PlaceGhostTownAction.define((action) => new HydratedPlaceGhostTown(action))
]
