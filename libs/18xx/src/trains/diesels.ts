import type { PhaseTable } from '../phases/phaseTable.js'
import type { TrainDepot } from './trainDepot.js'
import type { TrainInventory, TrainPurchaseState } from './train.js'
import type { TrainRules } from './trainPurchase.js'

/**
 * 1830-style diesels: on sale from a phase alongside the depot's next train, taking listed
 * trains in trade for a credit off their price.
 */
export function dieselTrains(options: {
    depot: TrainDepot
    phases: PhaseTable
    dieselId: string
    fromPhaseId: string
    tradeInIds: readonly string[]
    credit: number
}): Pick<TrainRules, 'availableDefinitions' | 'exchangePrice'> {
    const { depot, phases, dieselId, fromPhaseId, tradeInIds, credit } = options
    const onSale = (state: TrainPurchaseState) => phases.isAtLeast(state.phaseId, fromPhaseId)
    return {
        availableDefinitions(state) {
            const next = depot.nextDefinitionId(state.trainInventory)
            return [...new Set([...(next ? [next] : []), ...(onSale(state) ? [dieselId] : [])])]
        },
        exchangePrice: (state, _companyId, definitionId, train) =>
            onSale(state) && definitionId === dieselId && tradeInIds.includes(train.definitionId)
                ? depot.trainDefinition(dieselId).price - credit
                : undefined
    }
}

/**
 * A game's diesel variant over a table of numbered trains (1870 and 1850): the listed trains leave
 * the depot, diesels sell beside whatever comes next, and one train type stays on as permanent.
 */
export function dieselVariant(options: {
    depot: TrainDepot
    phases: PhaseTable
    dieselId: string
    fromPhaseId: string
    tradeInIds: readonly string[]
    credit: number
    /** Trains gone from a diesel game, and the one that stays in the depot but never sells. */
    removedIds: readonly string[]
    unsoldId: string
    permanentId: string
    active(state: object): boolean
}) {
    const {
        depot,
        phases,
        dieselId,
        tradeInIds,
        credit,
        removedIds,
        unsoldId,
        permanentId,
        active
    } = options
    const diesels = dieselTrains(options)
    return {
        terms: { dieselId, tradeInIds, credit, removedIds, unsoldId, permanentId },
        inventory(isActive: boolean): TrainInventory {
            const inventory = depot.createInventory()
            if (!isActive) return inventory
            return {
                ...inventory,
                trains: inventory.trains.filter((train) => !removedIds.includes(train.definitionId))
            }
        },
        exchangePrice: ((state, companyId, definitionId, train) =>
            active(state)
                ? diesels.exchangePrice(state, companyId, definitionId, train)
                : undefined) satisfies TrainRules['exchangePrice'],
        availableDefinitions: ((state) => {
            if (active(state))
                return diesels.availableDefinitions(state).filter((id) => id !== unsoldId)
            const next = depot.nextDefinitionId(state.trainInventory)
            return next ? [next] : []
        }) satisfies TrainRules['availableDefinitions'],
        rustTiming: (state: object & { phaseId: string }, train: { definitionId: string }) =>
            active(state) && train.definitionId === permanentId
                ? undefined
                : phases.rustTiming(state.phaseId, train.definitionId)
    }
}
