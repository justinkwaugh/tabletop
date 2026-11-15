import {
    PhaseTable,
    TrainDepot,
    dieselVariant,
    revenueStagesByPhase,
    requiresStationRoute,
    type TrainRules
} from '@tabletop/18xx'
import { Map1850 } from './map.js'
import { MesabiAccess } from './mesabiAccess.js'
import { requireState1850 } from './state.js'
import { TileSet1850 } from './tiles.js'

const distance = (maximum: number) => ({ measure: 'revenue-centers' as const, maximum })

// The train table (§2.5, §21). A company may buy another's last train, for at least $1 (§10.6, §10.8).
export const TrainDepot1850 = new TrainDepot({
    id: '1850',
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
        { definitionId: '2', count: 6 },
        { definitionId: '3', count: 6 },
        { definitionId: '4', count: 4 },
        { definitionId: '5', count: 3 },
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

// The phases, named after the train that starts each (§4.2, §21), with the diesel variant's last
// phase after them (§16.2). Grey tiles arrive with the 8s, or with the diesel in that variant.
export const Phases1850 = new PhaseTable(
    [
        { id: '2', startedBy: [], tileColors: yellow, operatingRounds: 1, trainLimit: 4 },
        { id: '3', startedBy: ['3'], tileColors: green, operatingRounds: 2, trainLimit: 4 },
        { id: '4', startedBy: ['4'], tileColors: green, operatingRounds: 2, trainLimit: 3 },
        { id: '5', startedBy: ['5'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        { id: '6', startedBy: ['6'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
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
    TrainDepot1850
)

// Off-board and Mesabi Range values: the first until the first 5-train, the second until the first
// 8-train or diesel, then the last (§4.2, §21).
export const revenueStages = revenueStagesByPhase(Phases1850, 'yellow', [
    ['brown', '5'],
    ['gray', '8']
])

// With diesels the 8s and 10s are gone and 12s never sell; diesels go on sale with the first 6-train,
// $1100 or $800 by trading in a 4, 5 or 6, and the 5s become permanent (§16.2).
export const DieselVariant1850 = dieselVariant({
    depot: TrainDepot1850,
    phases: Phases1850,
    dieselId: 'D',
    fromPhaseId: '6',
    tradeInIds: ['4', '5', '6'],
    credit: 300,
    removedIds: ['8', '10'],
    unsoldId: '12',
    permanentId: '5',
    active: (state) => !!requireState1850(state).variants.diesels
})

export const TrainRules1850: TrainRules = {
    depot: TrainDepot1850,
    // A route the company could run only through the Mesabi Range needs a token first (§8.1c, §10.1).
    requiresTrain: requiresStationRoute(Map1850, TileSet1850, MesabiAccess.open),
    exchangePrice: DieselVariant1850.exchangePrice,
    availableDefinitions: DieselVariant1850.availableDefinitions,
    phaseAfterPurchase: (state, definitionId) =>
        Phases1850.phaseAfterPurchase(state.phaseId, definitionId),
    trainLimit: (state) => Phases1850.phase(state.phaseId).trainLimit,
    // One new train a turn from the bank, and any number of used ones (§10.3).
    purchaseLimit: () => 1,
    privatesClosedByPurchase: () => []
}
