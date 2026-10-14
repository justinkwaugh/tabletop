import { EighteenThirtyMap } from './map.js'
import { EighteenThirtyTileSet } from './tiles.js'
import {
    PhaseTable,
    TrainDepot,
    dieselTrains,
    requiresStationRoute,
    type TrainInventory,
    type TrainRules
} from '@tabletop/18xx'

// The depot holds the optional third 6-train; ordinary games remove it at setup.
export const EighteenThirtyTrainDepot = new TrainDepot({
    id: '1830',
    trains: [
        {
            id: '2',
            name: '2',
            price: 80,
            distance: { measure: 'revenue-centers', maximum: 2 },
            rustsOn: '4'
        },
        {
            id: '3',
            name: '3',
            price: 180,
            distance: { measure: 'revenue-centers', maximum: 3 },
            rustsOn: '6'
        },
        {
            id: '4',
            name: '4',
            price: 300,
            distance: { measure: 'revenue-centers', maximum: 4 },
            rustsOn: 'D'
        },
        { id: '5', name: '5', price: 450, distance: { measure: 'revenue-centers', maximum: 5 } },
        { id: '6', name: '6', price: 630, distance: { measure: 'revenue-centers', maximum: 6 } },
        {
            id: 'D',
            name: 'Diesel',
            price: 1100,
            distance: { measure: 'revenue-centers', maximum: 'unlimited' }
        }
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

export function createEighteenThirtyTrainInventory(extraSixTrain: boolean): TrainInventory {
    const inventory = EighteenThirtyTrainDepot.createInventory()
    if (extraSixTrain) return inventory
    const optional = inventory.trains.findLast((train) => train.definitionId === '6')
    return {
        ...inventory,
        trains: inventory.trains.filter((train) => train !== optional)
    }
}

const yellow = ['yellow']
const green = ['yellow', 'green']
const brown = ['yellow', 'green', 'brown']
export const EighteenThirtyPhases = new PhaseTable(
    [
        { id: '2', startedBy: [], tileColors: yellow, operatingRounds: 1, trainLimit: 4 },
        { id: '3', startedBy: ['3'], tileColors: green, operatingRounds: 2, trainLimit: 4 },
        { id: '4', startedBy: ['4'], tileColors: green, operatingRounds: 2, trainLimit: 3 },
        { id: '5', startedBy: ['5'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        { id: '6', startedBy: ['6'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        { id: 'D', startedBy: ['D'], tileColors: brown, operatingRounds: 3, trainLimit: 2 }
    ],
    EighteenThirtyTrainDepot
)
export const EighteenThirtyTrainRules: TrainRules = {
    depot: EighteenThirtyTrainDepot,
    requiresTrain: requiresStationRoute(EighteenThirtyMap, EighteenThirtyTileSet),
    // Diesels go on sale with the first 6-train, taking 4-, 5- and 6-trains for $300 off.
    ...dieselTrains({
        depot: EighteenThirtyTrainDepot,
        phases: EighteenThirtyPhases,
        dieselId: 'D',
        fromPhaseId: '6',
        tradeInIds: ['4', '5', '6'],
        credit: 300
    }),
    phaseAfterPurchase: (state, definitionId) =>
        EighteenThirtyPhases.phaseAfterPurchase(state.phaseId, definitionId),
    trainLimit: (state) => EighteenThirtyPhases.phase(state.phaseId).trainLimit,
    purchaseLimit: () => 'unlimited',
    // The B&O private closes when the B&O railroad buys its first train.
    privatesClosedByPurchase: (state, companyId) =>
        companyId === 'BO'
            ? state.companies
                  .filter((company) => company.id === 'BOP' && !company.closed)
                  .map((company) => company.id)
            : []
}
