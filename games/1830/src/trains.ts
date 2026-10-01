import { EighteenThirtyMap } from './map.js'
import { EighteenThirtyTileSet } from './tiles.js'
import {
    PhaseTable,
    TrainDepot,
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
        trains: inventory.trains.map((train) =>
            train === optional ? { id: train.id, definitionId: '6', status: 'removed' } : train
        )
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
    exchangePrice: (state, _companyId, definitionId, train) =>
        EighteenThirtyPhases.isAtLeast(state.phaseId, '6') &&
        definitionId === 'D' &&
        ['4', '5', '6'].includes(train.definitionId)
            ? 800
            : undefined,
    requiresTrain: requiresStationRoute(EighteenThirtyMap, EighteenThirtyTileSet),
    availableDefinitions(state) {
        const next = EighteenThirtyTrainDepot.nextDefinitionId(state.trainInventory)
        return [
            ...new Set([
                ...(next ? [next] : []),
                ...(EighteenThirtyPhases.isAtLeast(state.phaseId, '6') ? ['D'] : [])
            ])
        ]
    },
    phaseAfterPurchase: (state, definitionId) =>
        EighteenThirtyPhases.phaseAfterPurchase(state.phaseId, definitionId),
    trainLimit: (state) => EighteenThirtyPhases.phase(state.phaseId).trainLimit,
    purchaseLimit: () => 'unlimited'
}
