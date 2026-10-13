import { Region } from '@tabletop/oath'
import type { TravelWay } from './actionOffers.js'

/** One way to pay as the chip draws it: its Supply, then a favor token per toll and the secret it flips. */
export type ChipWay = { cost: number; favor: number; secret: boolean }

/**
 * A lit site's cost chip. One way paid in Supply alone reads its words ("2 Supply"); a way with a
 * token is a number and symbols ("2+[favor]"), with "or" between two ways (R-11.12, R-7.1.4).
 */
export type TravelChip = { words: string } | { ways: ChipWay[] }

export function travelChip(ways: readonly TravelWay[]): TravelChip | undefined {
    const [only] = ways
    if (only === undefined) return undefined
    if (ways.length === 1 && !only.flipSecret && only.tolls.length === 0) {
        return { words: `${only.cost} Supply` }
    }
    return {
        ways: ways.map((way) => ({
            cost: way.cost,
            favor: way.tolls.length,
            secret: way.flipSecret
        }))
    }
}

/** The chip in words, as a lit site's accessible name reads it: "2 Supply", "2 Supply + 1 favor or 0 Supply + 1 secret". */
export function chipWords(chip: TravelChip): string {
    if ('words' in chip) return chip.words
    return chip.ways
        .map(
            (way) =>
                `${way.cost} Supply` +
                (way.favor > 0 ? ` + ${way.favor} favor` : '') +
                (way.secret ? ' + 1 secret' : '')
        )
        .join(' or ')
}

/**
 * R-11.7 — a site the Shrouded Wood's ruler may pick: the traveller's Supply in words, as one way
 * paid in Supply alone reads, or its number and the favor where Toll Roads will ask (R-7.1.4).
 */
export function woodChip(cost: number, toll: boolean): TravelChip {
    return toll ? { ways: [{ cost, favor: 1, secret: false }] } : { words: `${cost} Supply` }
}

export type RegionCount = { region: Region; count: number }

/** What a pick on the map frames on a phone: one region held upright, every lit site sideways. */
export type MapFrame = Region | 'all'

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

/** The region a pick on the map opens on: the pawn's, else the first with a lit site. */
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
