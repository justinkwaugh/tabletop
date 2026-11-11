import {
    PhaseTable,
    TrainDepot,
    dieselVariant,
    revenueStagesByPhase,
    requiresStationRoute,
    type TrainRules
} from '@tabletop/18xx'
import { Map1870 } from './map.js'
import { requireState1870 } from './state.js'
import { TileSet1870 } from './tiles.js'

const distance = (maximum: number) => ({ measure: 'revenue-centers' as const, maximum })

// The train table (p. 4, p. 31). A company may buy another's last train, for at least $1 (p. 21).
export const TrainDepot1870 = new TrainDepot({
    id: '1870',
    trains: [
        { id: '2', name: '2', price: 80, distance: distance(2), rustsOn: '4' },
        { id: '3', name: '3', price: 180, distance: distance(3), rustsOn: '6' },
        { id: '4', name: '4', price: 300, distance: distance(4), rustsOn: '8' },
        { id: '5', name: '5', price: 450, distance: distance(5), rustsOn: '12' },
        { id: '6', name: '6', price: 630, distance: distance(6) },
        { id: '8', name: '8', price: 800, distance: distance(8) },
        { id: '10', name: '10', price: 950, distance: distance(10) },
        { id: '12', name: '12', price: 1100, distance: distance(12) },
        {
            id: 'D',
            name: 'D',
            price: 1100,
            distance: { measure: 'revenue-centers', maximum: 'unlimited' }
        }
    ],
    supply: [
        { definitionId: '2', count: 7 },
        { definitionId: '3', count: 6 },
        { definitionId: '4', count: 5 },
        { definitionId: '5', count: 4 },
        { definitionId: '6', count: 3 },
        { definitionId: '8', count: 3 },
        { definitionId: '10', count: 2 },
        { definitionId: '12', count: 'unlimited' },
        { definitionId: 'D', count: 'unlimited' }
    ]
})

const yellow = ['yellow']
const green = ['yellow', 'green']
const brown = ['yellow', 'green', 'brown']
const gray = ['yellow', 'green', 'brown', 'gray']

// The rulebook's phases one to eight (pp. 4-6, p. 31), named by the train that starts each, with
// the diesel variant's last phase after them (p. 24).
export const Phases1870 = new PhaseTable(
    [
        { id: '2', startedBy: [], tileColors: yellow, operatingRounds: 1, trainLimit: 4 },
        { id: '3', startedBy: ['3'], tileColors: green, operatingRounds: 2, trainLimit: 4 },
        { id: '4', startedBy: ['4'], tileColors: green, operatingRounds: 2, trainLimit: 3 },
        { id: '5', startedBy: ['5'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        { id: '6', startedBy: ['6'], tileColors: gray, operatingRounds: 3, trainLimit: 2 },
        { id: '8', startedBy: ['8'], tileColors: gray, operatingRounds: 3, trainLimit: 2 },
        { id: '10', startedBy: ['10'], tileColors: gray, operatingRounds: 3, trainLimit: 2 },
        { id: '12', startedBy: ['12'], tileColors: gray, operatingRounds: 3, trainLimit: 2 },
        {
            id: 'D',
            startedBy: ['D'],
            tileColors: gray,
            operatingRounds: 3,
            trainLimit: 2,
            variantEnd: true
        }
    ],
    TrainDepot1870
)

// Red off-board values: the top until the first 5-train, the middle until the first 8-train or
// diesel, then the bottom (p. 31).
export const revenueStages = revenueStagesByPhase(Phases1870, 'yellow', [
    ['brown', '5'],
    ['gray', '8']
])

// With diesels the 8s and 10s are gone and 12s never sell; diesels go on sale with the first 6-train,
// $1100 or $800 by trading in a 4, 5 or 6, and the 5s become permanent (p. 24).
export const DieselVariant1870 = dieselVariant({
    depot: TrainDepot1870,
    phases: Phases1870,
    dieselId: 'D',
    fromPhaseId: '6',
    tradeInIds: ['4', '5', '6'],
    credit: 300,
    removedIds: ['8', '10'],
    unsoldId: '12',
    permanentId: '5',
    active: (state) => !!requireState1870(state).variants.diesels
})

export const TrainRules1870: TrainRules = {
    depot: TrainDepot1870,
    requiresTrain: requiresStationRoute(Map1870, TileSet1870),
    exchangePrice: DieselVariant1870.exchangePrice,
    availableDefinitions: DieselVariant1870.availableDefinitions,
    phaseAfterPurchase: (state, definitionId) =>
        Phases1870.phaseAfterPurchase(state.phaseId, definitionId),
    trainLimit: (state) => Phases1870.phase(state.phaseId).trainLimit,
    purchaseLimit: () => 'unlimited',
    privatesClosedByPurchase: () => []
}
