import { Region, type HydratedOathGameState, type Suit } from '@tabletop/oath'
import type { MapPick, TravelPickSite, TravelWay } from './actionOffers.js'
import { suitName } from './names.js'
import { hospitalityBanksOf, waysToPay } from './travelRows.js'

/** One way to pay as the chip draws it: its Supply, then a favor token per toll and the secret it flips. */
export type ChipWay = { cost: number; favor: number; secret: boolean }

/**
 * A lit site's cost chip. One way paid in Supply alone reads its words ("2 Supply"); a way with a
 * token is a number and symbols ("2+[favor]"), with "or" between two ways (R-11.12, R-7.1.4).
 * Where Hospitality gains, the costs are numbers and the chip ends with the gain and each bank's
 * suit ("2 | +1 [favor] [Beast] or [Nomad]"). On a move that spends no Supply only what it still
 * costs is drawn: Toll Roads' "toll 1 [favor]", The Hidden Place's "+[secret]".
 */
export type TravelChip =
    | { words: string }
    | { ways: ChipWay[]; banks?: Suit[] }
    | { free: { toll: boolean; secret: boolean } }

export function travelChip(
    ways: readonly (TravelWay & { hospitality?: Suit })[]
): TravelChip | undefined {
    const paying = waysToPay(ways)
    const [only] = paying
    if (only === undefined) return undefined
    const banks = hospitalityBanksOf(ways)
    if (paying.length === 1 && !only.flipSecret && only.tolls.length === 0 && banks.length === 0) {
        return { words: `${only.cost} Supply` }
    }
    return {
        ways: paying.map((way) => ({
            cost: way.cost,
            favor: way.tolls.length,
            secret: way.flipSecret
        })),
        ...(banks.length > 0 ? { banks } : {})
    }
}

/**
 * The chip in words, as a lit site's accessible name reads it: "2 Supply", "2 Supply + 1 favor or
 * 0 Supply + 1 secret", "2 Supply, gain 1 favor from the Beast or Nomad bank".
 */
export function chipWords(chip: TravelChip): string {
    if ('words' in chip) return chip.words
    if ('free' in chip) {
        return [chip.free.toll ? 'toll 1 favor' : '', chip.free.secret ? 'flip 1 secret' : '']
            .filter((words) => words !== '')
            .join(', ')
    }
    const costs = chip.ways
        .map(
            (way) =>
                `${way.cost} Supply` +
                (way.favor > 0 ? ` + ${way.favor} favor` : '') +
                (way.secret ? ' + 1 secret' : '')
        )
        .join(' or ')
    const banks = chip.banks ?? []
    return banks.length > 0
        ? `${costs}, gain 1 favor from the ${banks.map(suitName).join(' or ')} bank`
        : costs
}

/**
 * R-11.7 — a site the Shrouded Wood's ruler may pick: the traveller's Supply in words, as one way
 * paid in Supply alone reads, or its number and the favor where Toll Roads will ask (R-7.1.4).
 */
export function woodChip(cost: number, toll: boolean): TravelChip {
    return toll ? { ways: [{ cost, favor: 1, secret: false }] } : { words: `${cost} Supply` }
}

/**
 * R-11.7, R-11.13-H1 — a site a Travel question offers on the map: its price, as the Shrouded
 * Wood's ruler sees it for the traveller's own Travel; on a move that spends no Supply, no chip but
 * a toll Toll Roads will ask or the secret The Hidden Place flips.
 */
export function pickChip(site: Omit<TravelPickSite, 'siteId'>): TravelChip | undefined {
    if (site.cost !== undefined) return woodChip(site.cost, site.toll)
    if (!site.toll && !site.flip) return undefined
    return { free: { toll: site.toll, secret: site.flip } }
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

/**
 * The region a phone's upright pick on the map opens on: that of the pawn the pick moves (the
 * seat's own, a banished defender's, a pawn the Shrouded Wood's ruler sends), else the first
 * region with a lit site.
 */
export function mapPickOpening(
    pick: MapPick,
    state: Pick<HydratedOathGameState, 'regionOf' | 'getPlayerState'>
): Region | undefined {
    const siteId = pick.moverId ? state.getPlayerState(pick.moverId).siteId : undefined
    const counts = regionCounts(pick.sites, (slotId) => state.regionOf(slotId))
    return openingRegion(siteId ? state.regionOf(siteId) : undefined, counts)
}
