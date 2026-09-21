import { Shikoku1889Map } from './map.js'
import { Shikoku1889TileSet } from './tiles.js'
import { hasStationRoute, RailwayMapState } from '@tabletop/18xx'
import { PhaseTable, TrainDepot, type TrainRules } from '@tabletop/18xx'
export const Shikoku1889TrainDepot = new TrainDepot({
    id: 'shikoku-1889',
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
        { definitionId: '6', count: 2 },
        { definitionId: 'D', count: 'unlimited' }
    ]
})
const yellow = ['yellow']
const green = ['yellow', 'green']
const brown = ['yellow', 'green', 'brown']
export const Shikoku1889Phases = new PhaseTable(
    [
        { id: '2', startedBy: [], tileColors: yellow, operatingRounds: 1, trainLimit: 4 },
        { id: '3', startedBy: ['3'], tileColors: green, operatingRounds: 2, trainLimit: 4 },
        { id: '4', startedBy: ['4'], tileColors: green, operatingRounds: 2, trainLimit: 3 },
        { id: '5', startedBy: ['5'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        { id: '6', startedBy: ['6'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        { id: 'D', startedBy: ['D'], tileColors: brown, operatingRounds: 3, trainLimit: 2 }
    ],
    Shikoku1889TrainDepot
)
export const Shikoku1889TrainRules: TrainRules = {
    depot: Shikoku1889TrainDepot,
    exchangePrice: (state, _companyId, definitionId, train) =>
        Shikoku1889Phases.isAtLeast(state.phaseId, '6') &&
        definitionId === 'D' &&
        ['4', '5', '6'].includes(train.definitionId)
            ? 800
            : undefined,
    requiresTrain: (state, companyId) =>
        hasStationRoute(
            new RailwayMapState(Shikoku1889Map, Shikoku1889TileSet, state.tileInventory),
            state,
            companyId
        ),
    availableDefinitions(state) {
        const next = Shikoku1889TrainDepot.nextDefinitionId(state.trainInventory)
        return [
            ...new Set([
                ...(next ? [next] : []),
                ...(Shikoku1889Phases.isAtLeast(state.phaseId, '6') ? ['D'] : [])
            ])
        ]
    },
    phaseAfterPurchase: (state, definitionId) =>
        Shikoku1889Phases.phaseAfterPurchase(state.phaseId, definitionId),
    trainLimit: (state) => Shikoku1889Phases.phase(state.phaseId).trainLimit,
    purchaseLimit: () => 'unlimited'
}
