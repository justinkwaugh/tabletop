import { assert, assertExists } from '@tabletop/common'
import {
    PhaseTable,
    TrainDepot,
    dieselTrains,
    requiresStationRoute,
    type RevenueCenter,
    type TrainInventory,
    type TrainRules
} from '@tabletop/18xx'
import { CpId, CprId } from './ids.js'
import { FishingExit, Map1882 } from './map.js'
import { TileSet1882 } from './tiles.js'

const distance = (maximum: number | 'unlimited') =>
    ({ measure: 'revenue-centers', maximum }) as const

/**
 * The train roster (§11.7), with the four extra trains (a 3, 4, 5 and 6) counted in: they are set
 * aside at setup, and the Saskatchewan Central may bring one back (§3, §7.1.2).
 */
export const TrainDepot1882 = new TrainDepot({
    id: '1882',
    trains: [
        { id: '2', name: '2', price: 80, distance: distance(2), rustsOn: '4' },
        { id: '3', name: '3', price: 180, distance: distance(3), rustsOn: '6' },
        { id: '4', name: '4', price: 300, distance: distance(4), rustsOn: 'D' },
        { id: '5', name: '5', price: 450, distance: distance(5) },
        { id: '6', name: '6', price: 630, distance: distance(6) },
        { id: 'D', name: 'D', price: 1100, distance: distance('unlimited') }
    ],
    supply: [
        { definitionId: '2', count: 6 },
        { definitionId: '3', count: 5 },
        { definitionId: '4', count: 4 },
        { definitionId: '5', count: 3 },
        { definitionId: '6', count: 3 },
        { definitionId: 'D', count: 'unlimited' }
    ]
})

/** The trains with an extra copy set aside, which also name the rebellion's train (§3). */
export const ExtraTrainIds1882 = ['3', '4', '5', '6'] as const

/** The set-aside copy of a train: the last of its kind in the supply. */
export function extraTrainId(definitionId: string): string {
    const train = TrainDepot1882.createInventory().trains.findLast(
        (entry) => entry.definitionId === definitionId
    )
    assertExists(train, `No extra ${definitionId}-train`)
    return train.id
}

/** The supply as play begins: the extra trains set aside (§3). */
export function createTrainInventory1882(): TrainInventory {
    const inventory = TrainDepot1882.createInventory()
    const extras = ExtraTrainIds1882.map(extraTrainId)
    return { ...inventory, trains: inventory.trains.filter((train) => !extras.includes(train.id)) }
}

/** How many of a train the bank sells when no extra train joins them (§11.7). */
export function baseTrainCount(definitionId: string): number {
    const count = TrainDepot1882.definition.supply.find(
        (entry) => entry.definitionId === definitionId
    )?.count
    assert(typeof count === 'number', `The ${definitionId}-train supply is unlimited`)
    return ExtraTrainIds1882.some((id) => id === definitionId) ? count - 1 : count
}

const yellow = ['yellow']
const green = ['yellow', 'green']
const brown = ['yellow', 'green', 'brown']
export const Phases1882 = new PhaseTable(
    [
        { id: '2', startedBy: [], tileColors: yellow, operatingRounds: 1, trainLimit: 4 },
        { id: '3', startedBy: ['3'], tileColors: green, operatingRounds: 2, trainLimit: 4 },
        { id: '4', startedBy: ['4'], tileColors: green, operatingRounds: 2, trainLimit: 3 },
        { id: '5', startedBy: ['5'], tileColors: brown, operatingRounds: 3, trainLimit: 3 },
        { id: '6', startedBy: ['6'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        { id: 'D', startedBy: ['D'], tileColors: brown, operatingRounds: 3, trainLimit: 2 }
    ],
    TrainDepot1882
)

const notFishing = (_state: unknown, _companyId: string, center: RevenueCenter) =>
    center.locationId !== FishingExit

/**
 * A company with a route of two revenue locations must own a train (§11.7). Its president may
 * leave the fishing exit uncounted (§11.5), so a route to the fishing exit alone obliges none,
 * but the president may count it and raise money for a train as for a company that must.
 */
export const requiresTrain1882 = requiresStationRoute(Map1882, TileSet1882, notFishing)
const countingFishing = requiresStationRoute(Map1882, TileSet1882)

export const TrainRules1882: TrainRules = {
    depot: TrainDepot1882,
    requiresTrain: requiresTrain1882,
    mayRequireTrain: countingFishing,
    // D-trains go on sale with the first 6-train; a 4, 5 or 6 trades in for $800 (§11.7).
    ...dieselTrains({
        depot: TrainDepot1882,
        phases: Phases1882,
        dieselId: 'D',
        fromPhaseId: '6',
        tradeInIds: ['4', '5', '6'],
        credit: 300
    }),
    exchangedTrainDestination: 'removed',
    phaseAfterPurchase: (state, definitionId) =>
        Phases1882.phaseAfterPurchase(state.phaseId, definitionId),
    trainLimit: (state) => Phases1882.phase(state.phaseId).trainLimit,
    purchaseLimit: () => 'unlimited',
    // The Canadian Pacific private closes when the CPR buys a train (§7.1.5).
    privatesClosedByPurchase: (state, companyId) =>
        companyId === CprId
            ? state.companies
                  .filter((company) => company.id === CpId && !company.closed)
                  .map((company) => company.id)
            : []
}
