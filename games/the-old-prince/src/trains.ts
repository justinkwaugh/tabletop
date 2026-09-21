import { TheOldPrinceMap } from './map.js'
import { TheOldPrinceTileSet } from './tiles.js'
import { hasStationRoute, RailwayMapState } from '@tabletop/18xx'
import { PhaseTable, TrainDepot, type TrainRules } from '@tabletop/18xx'
export const TheOldPrinceTrainDepot = new TrainDepot({
    id: 'the-old-prince',
    trains: [
        {
            id: '2H',
            name: '2H',
            price: 80,
            distance: { measure: 'hex-edges', maximum: 2 },
            rustsOn: '5H'
        },
        {
            id: '3H',
            name: '3H',
            price: 100,
            distance: { measure: 'hex-edges', maximum: 3 },
            rustsOn: '6H'
        },
        {
            id: '4H',
            name: '4H',
            price: 120,
            distance: { measure: 'hex-edges', maximum: 4 },
            rustsOn: '2+'
        },
        {
            id: '5H',
            name: '5H',
            price: 160,
            distance: { measure: 'hex-edges', maximum: 5 },
            rustsOn: '3+'
        },
        {
            id: '6H',
            name: '6H',
            price: 180,
            distance: { measure: 'hex-edges', maximum: 6 },
            rustsOn: '4+'
        },
        {
            id: '2+',
            name: '2+',
            price: 220,
            distance: { measure: 'cities-and-offboards', maximum: 2 },
            rustsOn: '7'
        },
        {
            id: '3+',
            name: '3+',
            price: 240,
            distance: { measure: 'cities-and-offboards', maximum: 3 },
            rustsOn: 'D'
        },
        {
            id: '4+',
            name: '4+',
            price: 200,
            distance: { measure: 'cities-and-offboards', maximum: 4 },
            rustsOn: 'D'
        },
        { id: '7', name: '7', price: 500, distance: { measure: 'revenue-centers', maximum: 7 } },
        {
            id: 'D',
            name: 'Diesel',
            price: 600,
            distance: { measure: 'revenue-centers', maximum: 'unlimited' }
        }
    ],
    supply: [
        { definitionId: '2H', count: 4 },
        { definitionId: '3H', count: 3 },
        { definitionId: '4H', count: 3 },
        { definitionId: '5H', count: 3 },
        { definitionId: '6H', count: 2 },
        { definitionId: '2+', count: 4 },
        { definitionId: '3+', count: 3 },
        { definitionId: '4+', count: 2 },
        { definitionId: '7', count: 4 },
        { definitionId: 'D', count: 'unlimited' }
    ]
})
const yellow = ['yellow']
const green = ['yellow', 'green']
const brown = ['yellow', 'green', 'brown']
const gray = ['yellow', 'green', 'brown', 'gray']
export const TheOldPrincePhases = new PhaseTable(
    [
        { id: '2H', startedBy: [], tileColors: yellow, operatingRounds: 1, trainLimit: 4 },
        { id: '3H', startedBy: ['3H'], tileColors: yellow, operatingRounds: 1, trainLimit: 4 },
        { id: '4H', startedBy: ['4H'], tileColors: green, operatingRounds: 2, trainLimit: 4 },
        { id: '5H', startedBy: ['5H'], tileColors: green, operatingRounds: 2, trainLimit: 4 },
        { id: '6H', startedBy: ['6H'], tileColors: green, operatingRounds: 2, trainLimit: 4 },
        { id: '2+', startedBy: ['2+'], tileColors: green, operatingRounds: 2, trainLimit: 3 },
        { id: '3+', startedBy: ['3+'], tileColors: green, operatingRounds: 2, trainLimit: 3 },
        { id: '4+', startedBy: ['4+'], tileColors: brown, operatingRounds: 3, trainLimit: 3 },
        { id: '7', startedBy: ['7'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        { id: 'D', startedBy: ['D'], tileColors: gray, operatingRounds: 3, trainLimit: 2 }
    ],
    TheOldPrinceTrainDepot
)
export const TheOldPrinceTrainRules: TrainRules = {
    depot: TheOldPrinceTrainDepot,
    exchangePrice: () => undefined,
    requiresTrain: (state, companyId) =>
        companyId !== 'PEIR' &&
        hasStationRoute(
            new RailwayMapState(TheOldPrinceMap, TheOldPrinceTileSet, state.tileInventory),
            state,
            companyId
        ),
    availableDefinitions(state) {
        const next = TheOldPrinceTrainDepot.nextDefinitionId(state.trainInventory)
        return next ? [next] : []
    },
    phaseAfterPurchase: (state, definitionId) =>
        TheOldPrincePhases.phaseAfterPurchase(state.phaseId, definitionId),
    trainLimit: (state) => TheOldPrincePhases.phase(state.phaseId).trainLimit,
    purchaseLimit: (_state, companyId) => (companyId === 'PEIR' ? 1 : 'unlimited')
}
