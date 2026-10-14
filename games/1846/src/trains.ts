import { assertExists } from '@tabletop/common'
import {
    TrainDepot,
    PhaseTable,
    TrainPurchase,
    finishOperatingTurnReason,
    trainsOwnedBy,
    trainsCountingForLimit,
    trainCanBeTraded,
    type TrainInventory,
    type TrainPurchaseState,
    type TrainRules,
    releaseTrains
} from '@tabletop/18xx'
import type { HydratedEighteenFortySixState } from './state.js'
import { DraftCompanies } from './catalog.js'

export function independentTrainId(companyId: string): string {
    return `${companyId}:2`
}
export const TrainDepot1846 = new TrainDepot({
    id: '1846',
    trains: [
        { id: '2', name: '2', price: 80, distance: { measure: 'revenue-centers', maximum: 2 } },
        { id: '4', name: '4', price: 180, distance: { measure: 'revenue-centers', maximum: 4 } },
        {
            id: '3/5',
            name: '3/5',
            price: 160,
            distance: { measure: 'revenue-centers', maximum: 5 }
        },
        { id: '5', name: '5', price: 500, distance: { measure: 'revenue-centers', maximum: 5 } },
        {
            id: '4/6',
            name: '4/6',
            price: 450,
            distance: { measure: 'revenue-centers', maximum: 6 }
        },
        { id: '6', name: '6', price: 800, distance: { measure: 'revenue-centers', maximum: 6 } },
        { id: '7/8', name: '7/8', price: 900, distance: { measure: 'revenue-centers', maximum: 8 } }
    ],
    supplyVariants: { '1846:two-player': { '2': 5, '4': 5, '5': 3, '6': 4 } },
    assignedTrains: DraftCompanies.filter((company) => company.kind === 'independent').map(
        (company) => ({ id: independentTrainId(company.id), definitionId: '2' })
    ),
    supply: [
        { definitionId: '2', count: 7 },
        { definitionId: '4', variantDefinitionIds: ['3/5'], count: 6 },
        { definitionId: '5', variantDefinitionIds: ['4/6'], count: 5 },
        { definitionId: '6', variantDefinitionIds: ['7/8'], count: 'unlimited' }
    ]
})
export const Phases1846 = new PhaseTable(
    [
        { id: 'I', startedBy: [], tileColors: ['yellow'], operatingRounds: 2, trainLimit: 4 },
        {
            id: 'II',
            startedBy: ['4', '3/5'],
            tileColors: ['yellow', 'green'],
            operatingRounds: 2,
            trainLimit: 4
        },
        {
            id: 'III',
            startedBy: ['5', '4/6'],
            tileColors: ['yellow', 'green', 'brown'],
            operatingRounds: 2,
            trainLimit: 3
        },
        {
            id: 'IV',
            startedBy: ['6', '7/8'],
            tileColors: ['yellow', 'green', 'brown', 'gray'],
            operatingRounds: 2,
            trainLimit: 2
        }
    ],
    TrainDepot1846
)
export function createInitialTrainInventory(playerCount: number): TrainInventory {
    if (playerCount === 2) return TrainDepot1846.createInventory('1846:two-player')
    const inventory = TrainDepot1846.createInventory()
    for (const [definitionId, count] of [
        ['2', playerCount + 2],
        ['4', playerCount + 1],
        ['5', playerCount]
    ] as const)
        releaseTrains(
            inventory,
            inventory.trains
                .filter((train) => train.definitionId === definitionId)
                .slice(count)
                .map((train) => train.id),
            'removed'
        )
    return inventory
}
export function finalDepotEmpty(state: TrainPurchaseState): boolean {
    return (
        state.trainInventory.depotId === '1846:two-player' &&
        state.phaseId === 'IV' &&
        !TrainDepot1846.nextDefinitionId(state.trainInventory) &&
        !state.trainInventory.trains.some((train) => train.status === 'market')
    )
}
export const TrainRules1846: TrainRules = {
    depot: TrainDepot1846,
    exchangePrice: () => undefined,
    requiresTrain: (state) => !finalDepotEmpty(state),
    availableDefinitions: (state) => {
        const next = TrainDepot1846.nextDefinitionId(state.trainInventory)
        return next ? TrainDepot1846.certificateDefinitions(next) : []
    },
    marketDefinitions: (_state, train) => TrainDepot1846.certificateDefinitions(train.definitionId),
    phaseAfterPurchase: (state, definitionId) =>
        Phases1846.phaseAfterPurchase(state.phaseId, definitionId),
    countsForLimit: (_state, train) => trainCanBeTraded(train),
    trainLimit: (state) => Phases1846.phase(state.phaseId).trainLimit,
    purchaseLimit: () => 'unlimited'
}
export function trainBuyingChoices1846(state: HydratedEighteenFortySixState) {
    if (state.machineState !== 'BuyingTrains') return undefined
    const companyId = state.trainPurchaseStep?.companyId
    assertExists(companyId, 'Train buying requires an operating company')
    const purchase = new TrainPurchase(state, TrainRules1846)
    const offers = [
        ...purchase.offers().map((offer) => offer.evaluation),
        ...purchase.marketOffers()
    ].flatMap((evaluation) => (evaluation.details ? [evaluation.details] : []))
    const ownedTrainCount = trainsOwnedBy(state, { kind: 'company', companyId }).length
    const mustBuy = ownedTrainCount === 0 && TrainRules1846.requiresTrain(state, companyId)
    const supplyRemains =
        state.trainInventory.trains.some((train) => train.status === 'market') ||
        TrainRules1846.availableDefinitions(state).some(
            (id) => TrainDepot1846.remaining(state.trainInventory, id) !== 0
        )
    return {
        companyId,
        ownedTrainCount,
        countedTrainCount: trainsCountingForLimit(state, TrainRules1846, companyId).length,
        trainLimit: TrainRules1846.trainLimit(state, companyId),
        offers,
        mayFinish: !finishOperatingTurnReason(state, TrainRules1846, companyId),
        needsFunding: mustBuy && !offers.length && supplyRemains
    }
}
