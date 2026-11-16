import { assertExists } from '@tabletop/common'
import {
    PhaseTable,
    TrainDepot,
    dieselTrains,
    requiresStationRoute,
    type TrainInventory,
    type TrainRules
} from '@tabletop/18xx'
import { CvId } from './ids.js'
import { MapChesapeake } from './map.js'
import {
    OffTheRailsDieselId,
    OffTheRailsEditionChesapeake,
    OffTheRailsSupplyChesapeake,
    StandardEditionChesapeake,
    StandardSupplyChesapeake,
    editionChesapeake,
    type EditionChesapeake
} from './edition.js'
import { requireStateChesapeake } from './state.js'
import { TileSetChesapeake } from './tiles.js'

const distance = (maximum: number | 'unlimited') =>
    ({ measure: 'revenue-centers', maximum }) as const

/**
 * The train roster, with both D-trains: each game's supply sells only its own. Off the Rails
 * removes two each of the 2-, 3- and 4-trains and one 5-train.
 */
export const TrainDepotChesapeake = new TrainDepot({
    id: '18chesapeake',
    trains: [
        { id: '2', name: '2', price: 80, distance: distance(2), rustsOn: '4' },
        { id: '3', name: '3', price: 180, distance: distance(3), rustsOn: '6' },
        { id: '4', name: '4', price: 300, distance: distance(4), rustsOn: 'D' },
        { id: '5', name: '5', price: 500, distance: distance(5) },
        { id: '6', name: '6', price: 630, distance: distance(6) },
        { id: 'D', name: 'D', price: 900, distance: distance('unlimited') },
        { id: OffTheRailsDieselId, name: 'D', price: 1100, distance: distance('unlimited') }
    ],
    supply: [
        { definitionId: '2', count: 7 },
        { definitionId: '3', count: 6 },
        { definitionId: '4', count: 5 },
        { definitionId: '5', count: 3 },
        { definitionId: '6', count: 2 },
        { definitionId: 'D', count: 'unlimited' },
        { definitionId: OffTheRailsDieselId, count: 'unlimited' }
    ],
    supplyVariants: {
        [StandardSupplyChesapeake]: { [OffTheRailsDieselId]: 0 },
        [OffTheRailsSupplyChesapeake]: { '2': 5, '3': 4, '4': 3, '5': 2, D: 0 }
    }
})

/** The trains exported at the end of each set of operating rounds while one is next. */
const ExportedTrainIds: readonly string[] = ['2', '3', '4']

const yellow = ['yellow']
const green = ['yellow', 'green']
const brown = ['yellow', 'green', 'brown']
const gray = ['yellow', 'green', 'brown', 'gray']
export const PhasesChesapeake = new PhaseTable(
    [
        { id: '2', startedBy: [], tileColors: yellow, operatingRounds: 1, trainLimit: 4 },
        { id: '3', startedBy: ['3'], tileColors: green, operatingRounds: 2, trainLimit: 4 },
        { id: '4', startedBy: ['4'], tileColors: green, operatingRounds: 2, trainLimit: 3 },
        { id: '5', startedBy: ['5'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        { id: '6', startedBy: ['6'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        {
            id: 'D',
            startedBy: ['D', OffTheRailsDieselId],
            tileColors: gray,
            operatingRounds: 3,
            trainLimit: 2
        }
    ],
    TrainDepotChesapeake
)

// D-trains go on sale with the first 6-train, a 4, 5 or 6 trading in for a credit (§11.7).
const DieselSales = new Map(
    [StandardEditionChesapeake, OffTheRailsEditionChesapeake].map((edition) => [
        edition,
        dieselTrains({
            depot: TrainDepotChesapeake,
            phases: PhasesChesapeake,
            dieselId: edition.dieselId,
            fromPhaseId: '6',
            tradeInIds: ['4', '5', '6'],
            credit: edition.dieselCredit
        })
    ])
)
function dieselSales(state: object) {
    const sales = DieselSales.get(editionChesapeake(state))
    assertExists(sales, 'Every edition sells D-trains')
    return sales
}

/** The edition's train supply. */
export function createTrainInventoryChesapeake(edition: EditionChesapeake): TrainInventory {
    return TrainDepotChesapeake.createInventory(edition.supplyId)
}

/**
 * The train a set of operating rounds exports as it ends: the next in the bank while it is a 2, 3
 * or 4 (§11.9). Off the Rails exports none.
 */
export function trainsExportedChesapeake(state: { trainInventory: TrainInventory }): string[] {
    if (!editionChesapeake(state).exportsTrains) return []
    const next = TrainDepotChesapeake.nextDefinitionId(state.trainInventory)
    return next && ExportedTrainIds.includes(next) ? [next] : []
}

export const TrainRulesChesapeake: TrainRules = {
    depot: TrainDepotChesapeake,
    requiresTrain: requiresStationRoute(MapChesapeake, TileSetChesapeake),
    availableDefinitions: (state) => dieselSales(state).availableDefinitions?.(state) ?? [],
    exchangePrice: (state, companyId, definitionId, train) =>
        dieselSales(state).exchangePrice?.(state, companyId, definitionId, train),
    phaseAfterPurchase: (state, definitionId) =>
        PhasesChesapeake.phaseAfterPurchase(state.phaseId, definitionId),
    trainLimit: (state) => PhasesChesapeake.phase(state.phaseId).trainLimit,
    purchaseLimit: () => 'unlimited',
    // Cornelius Vanderbilt closes when the company whose presidency came with it buys a train.
    privatesClosedByPurchase: (state, companyId) =>
        requireStateChesapeake(state).corneliusCompanyId === companyId
            ? state.companies
                  .filter((company) => company.id === CvId && !company.closed)
                  .map((company) => company.id)
            : []
}
