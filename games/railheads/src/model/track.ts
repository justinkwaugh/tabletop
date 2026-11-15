import * as Type from 'typebox'
import { AxialCoordinates, sameCoordinates } from '@tabletop/common'
import { hexKey, type MapHex } from '../editions/editions.js'
import {
    CompanyId,
    Industry,
    TRACK_HEX_KINDS,
    isTollKind,
    type LayTrackRules
} from '../editions/types.js'
import type { TrackHex } from './components.js'
import { networkHexes } from './network.js'

export enum PlacementKind {
    Disc = 'Disc',
    Cube = 'Cube'
}

export enum IndustryBoost {
    Revenue = 'Revenue',
    Development = 'Development'
}

export type Placement = Type.Static<typeof Placement>
export const Placement = Type.Object({
    companyId: Type.Enum(CompanyId),
    coords: AxialCoordinates,
    kind: Type.Enum(PlacementKind),
    boost: Type.Optional(Type.Enum(IndustryBoost))
})

export type TubeBonus = Type.Static<typeof TubeBonus>
export const TubeBonus = Type.Object({
    companyId: Type.Enum(CompanyId),
    perShare: Type.Number()
})

export type PlacementEffect = Type.Static<typeof PlacementEffect>
export const PlacementEffect = Type.Object({
    companyId: Type.Enum(CompanyId),
    kind: Type.Enum(PlacementKind),
    cost: Type.Number(),
    crossedCompanyId: Type.Optional(Type.Enum(CompanyId)),
    revenueGain: Type.Number(),
    industry: Type.Optional(Type.Enum(Industry)),
    level: Type.Optional(Type.Number()),
    tollId: Type.Optional(Type.String()),
    // England & Wales: bonus dividends paid when the Underground couples with a company.
    bonuses: Type.Optional(Type.Array(TubeBonus))
})

export type PlacementTarget = {
    coords: AxialCoordinates
    kind: PlacementKind
    cost: number
    industry?: Industry
}

export function trackAt(
    track: readonly TrackHex[],
    coords: AxialCoordinates
): TrackHex | undefined {
    return track.find((hex) => sameCoordinates(hex.coords, coords))
}

export function networkKeys(track: readonly TrackHex[], companyId: CompanyId): Set<number> {
    return new Set(networkHexes(track, companyId).map((hex) => hexKey(hex.coords)))
}

export function discsPlaced(track: readonly TrackHex[], companyId: CompanyId): number {
    return track.reduce(
        (sum, hex) => sum + hex.discs.filter((disc) => disc === companyId).length,
        0
    )
}

export function cubesPlaced(track: readonly TrackHex[], companyId: CompanyId): number {
    return track.filter((hex) => hex.cube === companyId).length
}

export type PlacementContext = {
    track: readonly TrackHex[]
    companyId: CompanyId
    rules: LayTrackRules
    siteCapacity: (coords: AxialCoordinates) => number
    industryInDemand: (industry: Industry) => boolean
    discsLeft: number
    cubesLeft: number
    neighbours: (coords: AxialCoordinates) => AxialCoordinates[]
    isAnchor: (coords: AxialCoordinates) => boolean
}

export function placementKind(context: PlacementContext, place: MapHex): PlacementKind | undefined {
    if (!context.isAnchor(place.coords)) {
        return undefined
    }
    const discs = trackAt(context.track, place.coords)?.discs ?? []
    if (TRACK_HEX_KINDS.includes(place.kind)) {
        if (discs.length === 0) {
            return context.discsLeft > 0 && (!isTollKind(place.kind) || context.rules.tolls > 0)
                ? PlacementKind.Disc
                : undefined
        }
        const cube = trackAt(context.track, place.coords)?.cube
        return context.rules.allowsCrossingCubes &&
            context.cubesLeft > 0 &&
            cube === undefined &&
            !discs.includes(context.companyId)
            ? PlacementKind.Cube
            : undefined
    }
    return context.discsLeft > 0 &&
        discs.length < context.siteCapacity(place.coords) &&
        (place.industry === undefined || context.industryInDemand(place.industry)) &&
        !discs.includes(context.companyId)
        ? PlacementKind.Disc
        : undefined
}

export function isConnected(context: PlacementContext, coords: AxialCoordinates): boolean {
    const network = networkKeys(context.track, context.companyId)
    return context.neighbours(coords).some((neighbour) => network.has(hexKey(neighbour)))
}
