import { assertExists } from '@tabletop/common'
import { getCompany } from '../finance/finance.js'
import { NationalCompanyKind } from '../finance/receivership.js'
import type { AutomaticBorrowing } from '../loans/automaticBorrowing.js'
import type { PhaseTable } from '../phases/phaseTable.js'
import { ownsNoTrain } from './train.js'
import type { TrainDepot } from './trainDepot.js'
import { TrainPurchase, type TrainRules } from './trainPurchase.js'

/** A phase's train limits for minors and majors; a kind with none may hold no train. */
export type MinorAndMajorTrainLimits = Readonly<Record<string, { minor?: number; major?: number }>>

/**
 * Trains in a title of minors, majors and a national company (1861 §10.2, §10.10; 1867 GTG
 * §8.2, §8.11): the bank sells the next numbered train, and from a late phase the special trains
 * as well. Minors and majors have limits by phase; the national company has none. A company
 * without a train borrows to buy one from the bank, new or from its pool, but never from another
 * company; it must buy one if, borrowing all it may, it can afford one.
 */
export function minorAndMajorTrains(options: {
    depot: TrainDepot
    phases: PhaseTable
    limits: MinorAndMajorTrainLimits
    /** The special trains the bank also sells from a phase on, as the 5+5E and 2+2 in phase 8. */
    lateTrains: { phaseId: string; definitionIds: readonly string[] }
    loans: AutomaticBorrowing
    exchangePrice?: TrainRules['exchangePrice']
}): TrainRules {
    const { depot, phases, limits, lateTrains, loans } = options
    const rules: TrainRules = {
        depot,
        requiresTrain(state, companyId) {
            if (!ownsNoTrain(state, companyId) || !state.trainPurchaseStep) return false
            const purchase = new TrainPurchase(state, rules)
            return [
                ...purchase.offers().map((offer) => offer.evaluation),
                ...purchase.marketOffers()
            ].some((evaluation) => !!evaluation.details)
        },
        exchangePrice: options.exchangePrice ?? (() => undefined),
        availableDefinitions(state) {
            const next = depot.nextDefinitionId(state.trainInventory)
            const numbered = next && !lateTrains.definitionIds.includes(next) ? [next] : []
            const late = phases.isAtLeast(state.phaseId, lateTrains.phaseId)
                ? lateTrains.definitionIds.filter(
                      (definitionId) => depot.remaining(state.trainInventory, definitionId) !== 0
                  )
                : []
            return [...numbered, ...late]
        },
        phaseAfterPurchase: (state, definitionId) =>
            phases.phaseAfterPurchase(state.phaseId, definitionId),
        trainLimit(state, companyId) {
            const kind = getCompany(state, companyId).kind
            if (kind === NationalCompanyKind) return Number.MAX_SAFE_INTEGER
            const limit = limits[state.phaseId]
            assertExists(limit, `Phase ${state.phaseId} has train limits`)
            return (kind === 'minor' ? limit.minor : limit.major) ?? 0
        },
        purchaseLimit: () => 'unlimited',
        privatesClosedByPurchase: () => [],
        borrowing: {
            loans,
            allowed: (state, request) =>
                ownsNoTrain(state, request.companyId) &&
                !state.trainInventory.trains.some(
                    (train) => train.id === request.trainId && train.status === 'owned'
                )
        }
    }
    return rules
}
