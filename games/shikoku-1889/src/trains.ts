import { Shikoku1889Map } from './map.js'
import { Shikoku1889TileSet } from './tiles.js'
import { hasStationRoute, RailwayMapState } from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import { TrainDepot, type TrainRules } from '@tabletop/18xx'
export const Shikoku1889TrainDepot = new TrainDepot({
    id: 'shikoku-1889',
    trains: [
        { id: '2', name: '2', price: 80, distance: { measure: 'revenue-centers', maximum: 2 } },
        { id: '3', name: '3', price: 180, distance: { measure: 'revenue-centers', maximum: 3 } },
        { id: '4', name: '4', price: 300, distance: { measure: 'revenue-centers', maximum: 4 } },
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
export const Shikoku1889Phases = ['2', '3', '4', '5', '6', 'D']
export const Shikoku1889TrainLimits: Record<string, number> = { '2': 4, '3': 4, '4': 3, '5': 2, '6': 2, D: 2 }
export const Shikoku1889TrainRules: TrainRules = {
    depot: Shikoku1889TrainDepot,
    exchangePrice: (state, _companyId, definitionId, train) =>
        ['6', 'D'].includes(state.phaseId) &&
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
                ...(['6', 'D'].includes(state.phaseId) ? ['D'] : [])
            ])
        ]
    },
    phaseAfterPurchase(state, definitionId) {
        return Shikoku1889Phases[
            Math.max(
                Shikoku1889Phases.indexOf(state.phaseId),
                Shikoku1889Phases.indexOf(definitionId)
            )
        ]
    },
    trainLimit(state) {
        const limit = Shikoku1889TrainLimits[state.phaseId]
        assertExists(limit, 'Unknown train-limit phase')
        return limit
    },
    purchaseLimit: () => 'unlimited'
}
