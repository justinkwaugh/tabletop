import { requireEighteenThirtyTwoState } from './state.js'
import { shellsOf } from './systems.js'
import type { EighteenThirtyTwoTitleState } from './titleState.js'
import {
    PhaseTable,
    dieselTrains,
    TrainDepot,
    requiresStationRoute,
    type TrainInventory,
    type TrainRules
} from '@tabletop/18xx'
import { EighteenThirtyTwoMap } from './map.js'
import { EighteenThirtyTwoTileSet } from './tiles.js'

const distance = (maximum: number) => ({ measure: 'revenue-centers' as const, maximum })

// The rulebook's train table (§2.5, Table 1); its $630 6-train overrides the map's $600 (§19).
export const EighteenThirtyTwoTrainDepot = new TrainDepot({
    id: '1832',
    trains: [
        { id: '2', name: '2', price: 80, distance: distance(2), rustsOn: '4' },
        { id: '3', name: '3', price: 180, distance: distance(3), rustsOn: '6' },
        { id: '4', name: '4', price: 300, distance: distance(4), rustsOn: '8' },
        { id: '5', name: '5', price: 450, distance: distance(5), rustsOn: '12' },
        { id: '6', name: '6', price: 630, distance: distance(6) },
        { id: '8', name: '8', price: 800, distance: distance(8) },
        { id: '10', name: '10', price: 950, distance: distance(10) },
        { id: '12', name: '12', price: 1100, distance: distance(12) }
    ],
    supply: [
        { definitionId: '2', count: 7 },
        { definitionId: '3', count: 6 },
        { definitionId: '4', count: 4 },
        { definitionId: '5', count: 3 },
        { definitionId: '6', count: 3 },
        { definitionId: '8', count: 3 },
        { definitionId: '10', count: 2 },
        { definitionId: '12', count: 'unlimited' }
    ]
})

/** The depot's trains; the diesels variant takes the 8- and 10-trains out (§17.2). */
export function createEighteenThirtyTwoTrainInventory(
    variants: EighteenThirtyTwoTitleState['variants']
): TrainInventory {
    const inventory = EighteenThirtyTwoTrainDepot.createInventory()
    if (!variants.diesels) return inventory
    return {
        ...inventory,
        trains: inventory.trains.map((train) =>
            ['8', '10'].includes(train.definitionId)
                ? { id: train.id, definitionId: train.definitionId, status: 'removed' }
                : train
        )
    }
}

const yellow = ['yellow']
const green = ['yellow', 'green']
const brown = ['yellow', 'green', 'brown']
export const EighteenThirtyTwoPhases = new PhaseTable(
    [
        { id: '2', startedBy: [], tileColors: yellow, operatingRounds: 1, trainLimit: 4 },
        { id: '3', startedBy: ['3'], tileColors: green, operatingRounds: 2, trainLimit: 4 },
        { id: '4', startedBy: ['4'], tileColors: green, operatingRounds: 2, trainLimit: 3 },
        { id: '5', startedBy: ['5'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        { id: '6', startedBy: ['6'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        { id: '8', startedBy: ['8'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        { id: '10', startedBy: ['10'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        { id: '12', startedBy: ['12'], tileColors: brown, operatingRounds: 3, trainLimit: 2 }
    ],
    EighteenThirtyTwoTrainDepot
)

// Offboard and coal-field values: the first until phase 5, the second until phase 8, then the
// last (Table 1).
export function revenueStages(phaseId: string): readonly string[] {
    if (EighteenThirtyTwoPhases.isAtLeast(phaseId, '8')) return ['yellow', 'brown', 'gray']
    if (EighteenThirtyTwoPhases.isAtLeast(phaseId, '5')) return ['yellow', 'brown']
    return ['yellow']
}

// With diesels, 12-trains go on sale with the first 6-train as 1830's diesels, taking 4-, 5- and
// 6-trains for $300 off (§17.2).
const Diesels = dieselTrains({
    depot: EighteenThirtyTwoTrainDepot,
    phases: EighteenThirtyTwoPhases,
    dieselId: '12',
    fromPhaseId: '6',
    tradeInIds: ['4', '5', '6'],
    credit: 300
})

export const EighteenThirtyTwoTrainRules: TrainRules = {
    depot: EighteenThirtyTwoTrainDepot,
    requiresTrain: requiresStationRoute(EighteenThirtyTwoMap, EighteenThirtyTwoTileSet),
    exchangePrice: (state, companyId, definitionId, train) =>
        requireEighteenThirtyTwoState(state).variants.diesels
            ? Diesels.exchangePrice(state, companyId, definitionId, train)
            : undefined,
    availableDefinitions(state) {
        if (requireEighteenThirtyTwoState(state).variants.diesels)
            return Diesels.availableDefinitions(state)
        const next = EighteenThirtyTwoTrainDepot.nextDefinitionId(state.trainInventory)
        return next ? [next] : []
    },
    phaseAfterPurchase: (state, definitionId) =>
        EighteenThirtyTwoPhases.phaseAfterPurchase(state.phaseId, definitionId),
    // A System has both its shells' train spaces (§11.6.7).
    trainLimit: (state, companyId) =>
        EighteenThirtyTwoPhases.phase(state.phaseId).trainLimit *
        shellsOf(requireEighteenThirtyTwoState(state), companyId).length,
    purchaseLimit: () => 'unlimited',
    // The Central Railroad & Canal closes when the Central of Georgia buys its first train.
    privatesClosedByPurchase: (state, companyId) =>
        companyId === 'CG'
            ? state.companies
                  .filter((company) => company.id === 'P7' && !company.closed)
                  .map((company) => company.id)
            : []
}
