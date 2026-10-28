import type {
    Interconnection,
    PaidConnectionBonus,
    RouteRevenuePolicy,
    RouteRules,
    TrainRunningState
} from '@tabletop/18xx'
import { ferryValue, type FerryState } from './ferries.js'
import { Map1833NE, Places } from './map.js'
import { ownsPrivate } from './privates.js'
import { TileSet1833NE } from './tiles.js'
import { PayingStopLimits, Phases1833NE, TrainDepot1833NE, revenueStage } from './trains.js'

type Period = 'I-II' | 'III-IV' | 'V'
type PeriodValues = Partial<Record<Period, number>>

export function bonusPeriod(phaseId: string): Period {
    if (Phases1833NE.isAtLeast(phaseId, 'V')) return 'V'
    if (Phases1833NE.isAtLeast(phaseId, 'III')) return 'III-IV'
    return 'I-II'
}

const list = (locations: string | readonly string[]): readonly string[] =>
    typeof locations === 'string' ? [locations] : locations

type DirectBonus = {
    between: readonly [string | readonly string[], string | readonly string[]]
    values: PeriodValues
    destinationAtEnd?: true
    sourceId: string
    ogdensburg?: true
}

/**
 * Direct connection bonuses: the chart's totals, each the pair's direct arrow plus both its
 * interconnection arrows (rulebook p. 19).
 */
export const DirectBonuses: readonly DirectBonus[] = [
    {
        between: [Places.albanyTroy, Places.boston],
        values: { 'I-II': 100 },
        sourceId: 'direct'
    },
    {
        between: [Places.boston, Places.newYork],
        values: { 'III-IV': 60, V: 80 },
        sourceId: 'direct'
    },
    {
        between: [Places.boston, Places.montreal],
        values: { 'I-II': 150, 'III-IV': 200 },
        sourceId: 'direct'
    },
    {
        between: [Places.ogdensburg, Places.boston],
        values: { 'I-II': 120, 'III-IV': 180 },
        sourceId: 'direct',
        ogdensburg: true
    },
    {
        between: [Places.montreal, Places.portland],
        values: { 'I-II': 60, 'III-IV': 120, V: 80 },
        sourceId: 'direct'
    },
    {
        between: [Places.montreal, Places.portCities],
        values: { 'III-IV': 50, V: 80 },
        destinationAtEnd: true,
        sourceId: 'direct'
    },
    // The D&H hauls coal to Montreal: A12 is worth its value only with Montreal (p. 13).
    {
        between: [Places.delawareHudson, Places.montreal],
        values: { 'I-II': 40, 'III-IV': 70, V: 80 },
        sourceId: 'P6'
    }
]

type InterconnectionBonus = {
    from: string | readonly string[]
    to: string | readonly string[]
    values: PeriodValues
    ogdensburg?: true
}

export const InterconnectionBonuses: readonly InterconnectionBonus[] = [
    { from: Places.albanyTroy, to: Places.boston, values: { 'I-II': 50 } },
    { from: Places.boston, to: Places.montreal, values: { 'I-II': 30, 'III-IV': 50 } },
    { from: Places.montreal, to: Places.boston, values: { 'I-II': 70, 'III-IV': 90 } },
    { from: Places.boston, to: Places.ogdensburg, values: { 'I-II': 30, 'III-IV': 50 } },
    {
        from: Places.ogdensburg,
        to: Places.boston,
        values: { 'I-II': 40, 'III-IV': 70 },
        ogdensburg: true
    },
    {
        from: Places.montreal,
        to: Places.portland,
        values: { 'I-II': 30, 'III-IV': 60, V: 40 }
    },
    {
        from: Places.portland,
        to: Places.montreal,
        values: { 'I-II': 30, 'III-IV': 60, V: 40 }
    }
]

/** The Ogdensburg's owner doubles its bonuses to Boston until the private leaves in phase IV. */
function ogdensburgMultiplier(state: TrainRunningState, companyId: string): number {
    return ownsPrivate(state, companyId, 'P4') ? 2 : 1
}

export function routeBonusPolicy(
    state: TrainRunningState,
    companyId: string
): Pick<RouteRevenuePolicy, 'connectionBonuses' | 'interconnections'> {
    const period = bonusPeriod(state.phaseId)
    const doubled = ogdensburgMultiplier(state, companyId)
    const connectionBonuses = DirectBonuses.flatMap((bonus): PaidConnectionBonus[] => {
        const value = bonus.values[period]
        if (!value) return []
        const amount = value * (bonus.ogdensburg ? doubled : 1)
        return [
            {
                from: Object.fromEntries(list(bonus.between[0]).map((id) => [id, amount])),
                to: Object.fromEntries(list(bonus.between[1]).map((id) => [id, 0])),
                sourceId: bonus.ogdensburg && doubled > 1 ? 'P4' : bonus.sourceId,
                ...(bonus.destinationAtEnd ? { destinationAtEnd: true } : {})
            }
        ]
    })
    const interconnections = InterconnectionBonuses.flatMap((bonus): Interconnection[] => {
        const value = bonus.values[period]
        if (!value) return []
        return [
            {
                from: list(bonus.from),
                to: list(bonus.to),
                amount: value * (bonus.ogdensburg ? doubled : 1),
                sourceId: bonus.ogdensburg && doubled > 1 ? 'P4' : 'interconnection'
            }
        ]
    })
    return { connectionBonuses, interconnections }
}

export const RouteRules1833NE: RouteRules = {
    map: Map1833NE,
    tileSet: TileSet1833NE,
    depot: TrainDepot1833NE,
    revenueStage: (state) => revenueStage(state.phaseId),
    requiresCity: () => false,
    // A route visits one location of a tile with several, as Boston's (§6.63).
    oneStopPerHex: true,
    revenuePolicy: (train, state, companyId) => ({
        ...(PayingStopLimits[train.id]
            ? { payingStopLimit: PayingStopLimits[train.id], requirePayingStation: true }
            : {}),
        ...routeBonusPolicy(state, companyId)
    }),
    // Only the D&H's corporation may run to its offboard (§6.63).
    stopAllowed: (state, companyId, center) =>
        center.locationId !== Places.delawareHudson || ownsPrivate(state, companyId, 'P6'),
    stopBonus: (state: TrainRunningState & FerryState, _train, companyId, center) =>
        ferryValue(state, companyId, center.locationId),
    stopBonusSourceIds: (state: TrainRunningState & FerryState, _train, companyId, center) => {
        if (!ferryValue(state, companyId, center.locationId)) return []
        const luxury = state.ferries.some(
            (ferry) => ferry.locationId === center.locationId && ferry.luxury
        )
        return luxury ? ['ferry', 'P5'] : ['ferry']
    }
}
