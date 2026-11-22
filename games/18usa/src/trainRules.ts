import {
    trainsCountingForLimit,
    trainsOwnedBy,
    type Train,
    type TrainPurchaseState,
    type TrainRules
} from '@tabletop/18xx'
import {
    EighteenUSAPhases,
    EighteenUSATrainDepot,
    ObsoleteTrainIds,
    PullmanAvailablePhaseId,
    PullmanTrainId
} from './trains.js'
import { AmericanLocomotiveId, companyHolding } from './privateHolders.js'
import type { EighteenUSAState } from './state.js'

const LocomotiveDiscount = 0.1
const LocomotiveClosingTrainId = '6'

export const ownsPullman = (state: TrainPurchaseState, companyId: string): boolean =>
    trainsOwnedBy(state, { kind: 'company', companyId }).some(
        (train) => train.definitionId === PullmanTrainId
    )

export const obsolete = (train: Train): boolean =>
    train.status === 'owned' && !!train.rustsAfterOperation

/**
 * Trains come from the depot in order, with Pullmans beside them from phase 5, one a company
 * (§12.6, §12.7). A train made obsolete runs once more and no longer counts for the limit (§6.3).
 */
export const EighteenUSATrainRules: TrainRules = {
    depot: EighteenUSATrainDepot,
    exchangePrice: () => undefined,
    requiresTrain: () => false,
    availableDefinitions(state) {
        const next = EighteenUSATrainDepot.nextDefinitionId(state.trainInventory)
        const trains = next && next !== PullmanTrainId ? [next] : []
        return EighteenUSAPhases.isAtLeast(state.phaseId, PullmanAvailablePhaseId)
            ? [...trains, PullmanTrainId]
            : trains
    },
    phaseAfterPurchase: (state, definitionId) =>
        definitionId === PullmanTrainId
            ? state.phaseId
            : EighteenUSAPhases.phaseAfterPurchase(state.phaseId, definitionId),
    trainLimit: (state) => EighteenUSAPhases.phase(state.phaseId).trainLimit,
    // P13's saved train still counts (P13).
    // A company may hold only one Pullman, giving up any other a merger brings (§12.7).
    trainGroups(state, companyId) {
        const counting = trainsCountingForLimit(state, EighteenUSATrainRules, companyId)
        return [
            { trains: counting, limit: EighteenUSAPhases.phase(state.phaseId).trainLimit },
            {
                trains: counting.filter((train) => train.definitionId === PullmanTrainId),
                limit: 1
            }
        ]
    },
    countsForLimit: (state: TrainPurchaseState & Pick<EighteenUSAState, 'savedTrainId'>, train) =>
        !obsolete(train) || train.id === state.savedTrainId,
    limitReason: (state, companyId, definitionId) =>
        definitionId === PullmanTrainId && ownsPullman(state, companyId)
            ? 'A company may own only one Pullman.'
            : undefined,
    purchaseLimit: () => 'unlimited',
    // American Locomotive is discarded as the first 6-train is bought, not exported (P25).
    privatesClosedByPurchase: (state) =>
        state.companies.some((company) => company.id === AmericanLocomotiveId && !company.closed) &&
        state.trainInventory.trains.some(
            (train) =>
                train.status === 'owned' &&
                train.owner.kind === 'company' &&
                train.definitionId === LocomotiveClosingTrainId
        )
            ? [AmericanLocomotiveId]
            : [],
    // American Locomotive's company pays 10% less for the bank's trains (P25).
    bankPrice: (state, companyId, _definitionId, printed) =>
        companyHolding(state, AmericanLocomotiveId) === companyId
            ? printed - Math.round(printed * LocomotiveDiscount)
            : printed
}

export { ObsoleteTrainIds }
