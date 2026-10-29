import { assertExists } from '@tabletop/common'
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
import {
    PayingStopLimits,
    TrainDepot1833NE,
    ValuePeriods,
    revenueStage,
    valuePeriod,
    type PeriodValues
} from './trains.js'

const list = (locations: string | readonly string[]): readonly string[] =>
    typeof locations === 'string' ? [locations] : locations

type Place = string | readonly string[]

/**
 * The route bonus arrows printed beside the board (p. 24). A direct arrow pays a route that
 * includes both its places; an interconnection pays a route from one place extended to the
 * other. One arrow may serve several pairs, as Boston and Montreal or Ogdensburg.
 */
export type BonusArrow =
    | {
          id: string
          kind: 'direct'
          pairs: readonly (readonly [Place, Place])[]
          values: PeriodValues
          destinationAtEnd?: true
      }
    | { id: string; kind: 'interconnection'; from: Place; to: Place; values: PeriodValues }

export const BonusArrows: readonly BonusArrow[] = [
    {
        id: 'boston-and-albany-troy',
        kind: 'direct',
        pairs: [[Places.albanyTroy, Places.boston]],
        values: { 'I-II': 50 }
    },
    {
        id: 'boston-and-new-york',
        kind: 'direct',
        pairs: [[Places.boston, Places.newYork]],
        values: { 'III-IV': 60, V: 80 }
    },
    {
        id: 'boston-and-north',
        kind: 'direct',
        pairs: [
            [Places.boston, Places.montreal],
            [Places.ogdensburg, Places.boston]
        ],
        values: { 'I-II': 50, 'III-IV': 60 }
    },
    {
        id: 'montreal-port-city',
        kind: 'direct',
        pairs: [[Places.montreal, Places.portCities]],
        values: { 'III-IV': 50, V: 80 },
        destinationAtEnd: true
    },
    {
        id: 'albany-troy-to-boston',
        kind: 'interconnection',
        from: Places.albanyTroy,
        to: Places.boston,
        values: { 'I-II': 50 }
    },
    {
        id: 'boston-to-montreal',
        kind: 'interconnection',
        from: Places.boston,
        to: Places.montreal,
        values: { 'I-II': 30, 'III-IV': 50 }
    },
    {
        id: 'montreal-to-boston',
        kind: 'interconnection',
        from: Places.montreal,
        to: Places.boston,
        values: { 'I-II': 70, 'III-IV': 90 }
    },
    {
        id: 'boston-to-ogdensburg',
        kind: 'interconnection',
        from: Places.boston,
        to: Places.ogdensburg,
        values: { 'I-II': 30, 'III-IV': 50 }
    },
    {
        id: 'ogdensburg-to-boston',
        kind: 'interconnection',
        from: Places.ogdensburg,
        to: Places.boston,
        values: { 'I-II': 40, 'III-IV': 70 }
    },
    {
        id: 'montreal-to-portland',
        kind: 'interconnection',
        from: Places.montreal,
        to: Places.portland,
        values: { 'I-II': 30, 'III-IV': 60, V: 40 }
    },
    {
        id: 'portland-to-montreal',
        kind: 'interconnection',
        from: Places.portland,
        to: Places.montreal,
        values: { 'I-II': 30, 'III-IV': 60, V: 40 }
    }
]

export function bonusArrow(id: string): BonusArrow {
    const arrow = BonusArrows.find((entry) => entry.id === id)
    assertExists(arrow, `Unknown bonus arrow ${id}`)
    return arrow
}

type Pair = readonly [Place, Place]
const samePlace = (a: Place, b: Place) => list(a).join() === list(b).join()
const samePair = (a: Pair, b: Pair) =>
    (samePlace(a[0], b[0]) && samePlace(a[1], b[1])) ||
    (samePlace(a[0], b[1]) && samePlace(a[1], b[0]))
const interconnections = BonusArrows.flatMap((arrow) =>
    arrow.kind === 'interconnection' ? [arrow] : []
)

type DirectBonus = {
    between: Pair
    values: PeriodValues
    destinationAtEnd?: true
    sourceId: string
}

/**
 * A route including both places of a pair earns its direct value plus the pair's
 * interconnections both ways (§6.66): every pair a direct arrow or an interconnection names.
 */
function directBonus(between: Pair): DirectBonus {
    const direct = BonusArrows.find(
        (arrow) => arrow.kind === 'direct' && arrow.pairs.some((pair) => samePair(pair, between))
    )
    const both = interconnections.filter((arrow) => samePair([arrow.from, arrow.to], between))
    const values = Object.fromEntries(
        ValuePeriods.flatMap(({ id }) => {
            const total =
                (direct?.values[id] ?? 0) +
                both.reduce((sum, arrow) => sum + (arrow.values[id] ?? 0), 0)
            return total ? [[id, total]] : []
        })
    )
    return {
        between,
        values,
        sourceId: 'direct',
        ...(direct?.kind === 'direct' && direct.destinationAtEnd
            ? { destinationAtEnd: true as const }
            : {})
    }
}

const DirectBonuses: readonly DirectBonus[] = [
    ...BonusArrows.flatMap((arrow): Pair[] =>
        arrow.kind === 'direct' ? [...arrow.pairs] : [[arrow.from, arrow.to]]
    )
        .filter((pair, index, all) => all.findIndex((other) => samePair(other, pair)) === index)
        .map(directBonus),
    // The D&H hauls coal to Montreal: A12 is worth its value only with Montreal (p. 13).
    {
        between: [Places.delawareHudson, Places.montreal],
        values: { 'I-II': 40, 'III-IV': 70, V: 80 },
        sourceId: 'P6'
    }
]

/** The Ogdensburg's owner doubles its bonuses to Boston until the private leaves in phase IV. */
function ogdensburgMultiplier(state: TrainRunningState, companyId: string): number {
    return ownsPrivate(state, companyId, 'P4') ? 2 : 1
}

const fromOgdensburgToBoston = (from: Place, to: Place) =>
    samePlace(from, Places.ogdensburg) && samePlace(to, Places.boston)

export function routeBonusPolicy(
    state: TrainRunningState,
    companyId: string
): Pick<RouteRevenuePolicy, 'connectionBonuses' | 'interconnections'> {
    const period = valuePeriod(state.phaseId)
    const doubled = ogdensburgMultiplier(state, companyId)
    const scaled = (from: Place, to: Place, value: number, sourceId: string) =>
        fromOgdensburgToBoston(from, to) && doubled > 1
            ? { amount: value * doubled, sourceId: 'P4' }
            : { amount: value, sourceId }
    const connectionBonuses = DirectBonuses.flatMap((bonus): PaidConnectionBonus[] => {
        const value = bonus.values[period]
        if (!value) return []
        const { amount, sourceId } = scaled(...bonus.between, value, bonus.sourceId)
        return [
            {
                from: Object.fromEntries(list(bonus.between[0]).map((id) => [id, amount])),
                to: Object.fromEntries(list(bonus.between[1]).map((id) => [id, 0])),
                sourceId,
                ...(bonus.destinationAtEnd ? { destinationAtEnd: true } : {})
            }
        ]
    })
    const interconnectionBonuses = interconnections.flatMap((arrow): Interconnection[] => {
        const value = arrow.values[period]
        if (!value) return []
        return [
            {
                from: list(arrow.from),
                to: list(arrow.to),
                ...scaled(arrow.from, arrow.to, value, 'interconnection')
            }
        ]
    })
    return { connectionBonuses, interconnections: interconnectionBonuses }
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
        ...routeBonusPolicy(state, companyId),
        // A stop an N/M train passes without counting stays on its route for bonuses (§6.66).
        bonusesAlongRoute: true
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
