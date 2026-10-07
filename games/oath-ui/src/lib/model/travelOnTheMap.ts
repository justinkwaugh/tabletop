import { Region } from '@tabletop/oath'
import type { TravelWay } from './actionOffers.js'

/** One way to pay as the chip draws it: its Supply, then a favor token per toll and the secret it flips. */
export type ChipWay = { cost: number; favor: number; secret: boolean }

/**
 * A lit site's cost chip. One way paid in Supply alone keeps its words ("2 supply", a toll named
 * after it); otherwise each way is a number and symbols, with "or" between them (R-11.12).
 */
export type TravelChip = { words: string } | { ways: ChipWay[] }

export function travelChip(ways: readonly TravelWay[], toll: string): TravelChip | undefined {
    const [only] = ways
    if (only === undefined) return undefined
    if (ways.length === 1 && !only.flipSecret) return { words: `${only.cost} supply${toll}` }
    return {
        ways: ways.map((way) => ({
            cost: way.cost,
            favor: way.tolls.length,
            secret: way.flipSecret
        }))
    }
}

export type RegionCount = { region: Region; count: number }

/** What a Travel on a phone frames: one region held upright, every site held sideways. */
export type TravelFrame = Region | 'all'

const BOARD_ORDER: readonly Region[] = [Region.Cradle, Region.Provinces, Region.Hinterland]

/** The lit sites counted by region, in the board's order (R-2.1.1), an empty region at 0. */
export function regionCounts(
    slotIds: readonly string[],
    regionOf: (slotId: string) => Region
): RegionCount[] {
    return BOARD_ORDER.map((region) => ({
        region,
        count: slotIds.filter((slotId) => regionOf(slotId) === region).length
    }))
}

/** The region a Travel on a phone opens on: the pawn's, else the first with a destination. */
export function openingRegion(
    pawnRegion: Region | undefined,
    counts: readonly RegionCount[]
): Region | undefined {
    const lit = counts.filter(({ count }) => count > 0).map(({ region }) => region)
    if (pawnRegion !== undefined && (lit.includes(pawnRegion) || lit.length === 0)) {
        return pawnRegion
    }
    return lit[0]
}
