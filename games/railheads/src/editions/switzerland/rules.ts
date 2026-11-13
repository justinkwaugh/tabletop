import { networkHexes } from '../../model/network.js'
import { HexKind, type EndBonusContext } from '../types.js'
import { Country } from './map.js'

// Track Info (Countryside) on the board: the cube costs half the disc, rounded up.
export function swissTrackCost(hexKind: HexKind, _discsBelow: number, span: number): number {
    switch (hexKind) {
        case HexKind.Countryside:
            return 2
        case HexKind.Hillside:
            return 3
        case HexKind.Tunnel:
            return 4 * span
        default:
            return 4
    }
}

export function swissCubeCost(hexKind: HexKind, span: number): number {
    switch (hexKind) {
        case HexKind.Hillside:
            return 2
        case HexKind.Tunnel:
            return 2 * span
        default:
            return 1
    }
}

// The Loan Table's dividend brackets: +1 for one or two loans, up to +5 for nine or ten.
export function creditSuisseDividend(loans: number): number {
    return Math.ceil(loans / 2)
}

// The Revenue Track marks a Loan Limit every five spaces: none up to 5, one up to 10, and on.
export function loanLimit(revenue: number): number {
    return Math.min(10, Math.max(0, Math.ceil(revenue / 5) - 1))
}

// The subsidy boxes beside each flag, by Industry Sites of that country reached.
const TRANSALPINE: readonly (readonly [Country, readonly number[]])[] = [
    [Country.France, [0, 6, 9]],
    [Country.Germany, [0, 6, 9]],
    [Country.Austria, [0, 4, 8]]
]
const CISALPINE: readonly number[] = [0, 1, 2]

function sitesReached(context: EndBonusContext, country: Country): number {
    return networkHexes(context.track, context.companyId).filter(
        (hex) => context.map.hex(hex.coords).regionId === country
    ).length
}

function fromTable(table: readonly number[], reached: number): number {
    return table[Math.min(reached, table.length - 1)]
}

export function transalpineFactor(context: EndBonusContext): number {
    return TRANSALPINE.reduce(
        (sum, [country, table]) => sum + fromTable(table, sitesReached(context, country)),
        0
    )
}

export function cisalpineFactor(context: EndBonusContext): number {
    return fromTable(CISALPINE, sitesReached(context, Country.Italy))
}

// Total Subsidies per share: the transalpine sum times the Italian factor, forfeited by a
// company over its Loan Limit.
export function totalSubsidiesPerShare(context: EndBonusContext): number {
    if (context.loans > loanLimit(context.revenue)) return 0
    return transalpineFactor(context) * cisalpineFactor(context)
}
