import { assertExists } from '@tabletop/common'
import { TrainDepot, type TrainRules } from '@tabletop/18xx'
export const TheOldPrinceTrainDepot = new TrainDepot({
    id: 'the-old-prince',
    trains: [
        { id: '2H', name: '2H', price: 80, distance: { measure: 'hex-edges', maximum: 2 } },
        { id: '3H', name: '3H', price: 100, distance: { measure: 'hex-edges', maximum: 3 } },
        { id: '4H', name: '4H', price: 120, distance: { measure: 'hex-edges', maximum: 4 } },
        { id: '5H', name: '5H', price: 160, distance: { measure: 'hex-edges', maximum: 5 } },
        { id: '6H', name: '6H', price: 180, distance: { measure: 'hex-edges', maximum: 6 } },
        {
            id: '2+',
            name: '2+',
            price: 220,
            distance: { measure: 'cities-and-offboards', maximum: 2 }
        },
        {
            id: '3+',
            name: '3+',
            price: 240,
            distance: { measure: 'cities-and-offboards', maximum: 3 }
        },
        {
            id: '4+',
            name: '4+',
            price: 200,
            distance: { measure: 'cities-and-offboards', maximum: 4 }
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
const Phases = ['2H', '3H', '4H', '5H', '6H', '2+', '3+', '4+', '7', 'D']
const Limits: Record<string, number> = {
    '2H': 4,
    '3H': 4,
    '4H': 4,
    '5H': 4,
    '6H': 4,
    '2+': 3,
    '3+': 3,
    '4+': 3,
    '7': 2,
    D: 2
}
export const TheOldPrinceTrainRules: TrainRules = {
    depot: TheOldPrinceTrainDepot,
    availableDefinitions(state) {
        const next = TheOldPrinceTrainDepot.nextDefinitionId(state.trainInventory)
        return next ? [next] : []
    },
    phaseAfterPurchase(state, definitionId) {
        return Phases[Math.max(Phases.indexOf(state.phaseId), Phases.indexOf(definitionId))]
    },
    trainLimit(state) {
        const limit = Limits[state.phaseId]
        assertExists(limit, 'Unknown train-limit phase')
        return limit
    },
    purchaseLimit: (_state, companyId) => (companyId === 'PEIR' ? 1 : 'unlimited')
}
