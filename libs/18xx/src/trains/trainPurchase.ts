import type { MapStateData } from '../map/mapState.js'
import type { AccessRightState } from '../rights/accessRights.js'
import { actsFor } from '../finance/receivership.js'
import * as Type from 'typebox'
import { assert } from '@tabletop/common'
import { cashOwnedBy, getCompany } from '../finance/finance.js'
import {
    trainsOwnedBy,
    trainCanBeTraded,
    type Train,
    type TrainDestination,
    type TrainPurchaseState
} from './train.js'
import type { TrainDepot } from './trainDepot.js'
import type { DeparturePayment, TrainDeparture } from './trainDepartures.js'
import type { AutomaticBorrowing } from '../loans/automaticBorrowing.js'
export interface TrainRules {
    depot: TrainDepot
    exchangePrice(
        state: TrainPurchaseState,
        companyId: string,
        definitionId: string,
        train: Train
    ): number | undefined
    requiresTrain(
        state: TrainPurchaseState & MapStateData & AccessRightState,
        companyId: string
    ): boolean
    availableDefinitions(state: TrainPurchaseState): string[]
    phaseAfterPurchase(state: TrainPurchaseState, definitionId: string): string
    trainLimit(state: TrainPurchaseState, companyId: string): number
    countsForLimit?(state: TrainPurchaseState, train: Train): boolean
    /**
     * Whether a train is one a company must own; every train unless the title says, as 1822's
     * permanent 2-trains and Pullmans leave their company still obliged to buy one (§5.5.13).
     */
    satisfiesRequirement?(state: TrainPurchaseState, train: Train): boolean
    /**
     * Why the company may not take on a train of this definition beyond ``trainLimit``, as limits
     * for each kind of train do (1862); judged before any depot or intercompany purchase.
     */
    limitReason?(
        state: TrainPurchaseState,
        companyId: string,
        definitionId: string
    ): string | undefined
    marketDefinitions?(state: TrainPurchaseState, train: Train): readonly string[]
    purchaseLimit(state: TrainPurchaseState, companyId: string): number | 'unlimited'
    /**
     * Where a train given in exchange goes: the open market unless the title removes it, or back
     * into the depot's supply where the exchange turns one certificate over, as an 1822 L train
     * flipped to its 2 side (§5.5.7).
     */
    exchangedTrainDestination?: TrainDestination | 'depot'
    /** The open privates that close when the company acquires a train by any purchase. */
    privatesClosedByPurchase?(state: TrainPurchaseState, companyId: string): readonly string[]
    /**
     * Loans the company takes for a purchase its cash cannot pay for, where the title allows it
     * for this purchase, as an 1861 company without a train borrows for one from the bank (§10.2).
     */
    borrowing?: {
        loans: AutomaticBorrowing
        allowed(state: TrainPurchaseState, request: TrainPurchaseRequest): boolean
    }
    /** Records the title's consequences of trains departing, returning what the bank pays. */
    afterTrainsDepart?(
        state: TrainPurchaseState,
        departures: readonly TrainDeparture[]
    ): DeparturePayment[]
}
/** Whether the company owns a train of the kind it is required to own. */
export function ownsRequiredTrain(
    state: TrainPurchaseState,
    rules: Pick<TrainRules, 'satisfiesRequirement'>,
    companyId: string
): boolean {
    return trainsOwnedBy(state, { kind: 'company', companyId }).some(
        (train) => rules.satisfiesRequirement?.(state, train) ?? true
    )
}
export function trainsCountingForLimit(
    state: TrainPurchaseState,
    rules: Pick<TrainRules, 'countsForLimit'>,
    companyId: string
): Train[] {
    return trainsOwnedBy(state, { kind: 'company', companyId }).filter(
        (train) => rules.countsForLimit?.(state, train) ?? true
    )
}
export const TrainPurchaseRequest = Type.Object(
    {
        companyId: Type.String({ minLength: 1 }),
        trainId: Type.String({ minLength: 1 }),
        definitionId: Type.String({ minLength: 1 }),
        exchangeTrainId: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
)
export type TrainPurchaseRequest = Type.Static<typeof TrainPurchaseRequest>
export const TrainPurchaseDetails = Type.Object(
    { ...TrainPurchaseRequest.properties, price: Type.Integer({ minimum: 0 }) },
    { additionalProperties: false }
)
export type TrainPurchaseDetails = Type.Static<typeof TrainPurchaseDetails>
export type TrainPurchaseEvaluation =
    { details: TrainPurchaseDetails; reason?: never } | { details?: never; reason: string }
export class TrainPurchase {
    constructor(
        private readonly state: TrainPurchaseState,
        private readonly rules: TrainRules
    ) {}
    canAct(playerId: string | undefined, companyId: string): boolean {
        return (
            this.state.trainPurchaseStep?.companyId === companyId &&
            !getCompany(this.state, companyId).closed &&
            actsFor(this.state, playerId, companyId)
        )
    }
    offers(): {
        definitionId: string
        remaining: number | 'unlimited'
        evaluation: TrainPurchaseEvaluation
    }[] {
        return this.rules.depot.purchaseDefinitionIds().map((definitionId) => {
            const train = this.rules.depot.nextTrain(this.state.trainInventory, definitionId)
            return {
                definitionId,
                remaining: this.rules.depot.remaining(this.state.trainInventory, definitionId),
                evaluation:
                    train && this.state.trainPurchaseStep
                        ? this.evaluate({
                              companyId: this.state.trainPurchaseStep.companyId,
                              trainId: train.id,
                              definitionId
                          })
                        : {
                              reason: train
                                  ? 'Train purchasing is not active.'
                                  : 'This train is sold out.'
                          }
            }
        })
    }
    /**
     * What borrowing would add to the buying company's cash toward a train from the bank, where
     * the title lets it borrow for one, as an 1861 company without a train may (§10.2).
     */
    depotBorrowing(): number {
        const companyId = this.state.trainPurchaseStep?.companyId
        const borrowing = this.rules.borrowing
        if (!companyId || !borrowing) return 0
        const request = this.rules.availableDefinitions(this.state).flatMap((definitionId) => {
            const train = this.rules.depot.nextTrain(this.state.trainInventory, definitionId)
            return train ? [{ companyId, trainId: train.id, definitionId }] : []
        })[0]
        return request && borrowing.allowed(this.state, request)
            ? borrowing.loans.capacity(this.state, companyId)
            : 0
    }
    marketOffers(): TrainPurchaseEvaluation[] {
        const companyId = this.state.trainPurchaseStep?.companyId
        return companyId
            ? this.state.trainInventory.trains
                  .filter((train) => train.status === 'market')
                  .flatMap((train) =>
                      (
                          this.rules.marketDefinitions?.(this.state, train) ?? [train.definitionId]
                      ).map((definitionId) =>
                          this.evaluate({ companyId, trainId: train.id, definitionId })
                      )
                  )
            : []
    }
    exchanges(): TrainPurchaseDetails[] {
        const companyId = this.state.trainPurchaseStep?.companyId
        if (!companyId) return []
        return this.rules.availableDefinitions(this.state).flatMap((definitionId) => {
            const train = this.rules.depot.nextTrain(this.state.trainInventory, definitionId)
            if (!train) return []
            return trainsOwnedBy(this.state, { kind: 'company', companyId }).flatMap(
                (exchanged) => {
                    const result = this.evaluate({
                        companyId,
                        definitionId,
                        trainId: train.id,
                        exchangeTrainId: exchanged.id
                    })
                    return result.details ? [result.details] : []
                }
            )
        })
    }
    evaluate(request: TrainPurchaseRequest): TrainPurchaseEvaluation {
        const { companyId, trainId, definitionId, exchangeTrainId } = request
        const step = this.state.trainPurchaseStep
        if (step?.companyId !== companyId) return { reason: 'This company is not buying trains.' }
        if (getCompany(this.state, companyId).closed)
            return { reason: 'A closed company cannot buy a train.' }
        const marketTrain = this.state.trainInventory.trains.find(
            (train) =>
                train.id === trainId &&
                (
                    this.rules.marketDefinitions?.(this.state, train) ?? [train.definitionId]
                ).includes(definitionId) &&
                train.status === 'market'
        )
        const train =
            marketTrain ?? this.rules.depot.nextTrain(this.state.trainInventory, definitionId)
        if (train?.id !== trainId) return { reason: 'This train is no longer available.' }
        if (!marketTrain && !this.rules.availableDefinitions(this.state).includes(definitionId))
            return { reason: 'This train rank is not yet available.' }
        const limit = this.rules.trainLimit(this.state, companyId)
        assert(Number.isInteger(limit) && limit >= 0, 'Invalid train limit')
        const exchanged = exchangeTrainId
            ? trainsOwnedBy(this.state, { kind: 'company', companyId }).find(
                  (train) => train.id === exchangeTrainId
              )
            : undefined
        const exchangePrice = exchanged
            ? this.rules.exchangePrice(this.state, companyId, definitionId, exchanged)
            : undefined
        if (
            exchangeTrainId &&
            (!exchanged ||
                !trainCanBeTraded(exchanged) ||
                marketTrain ||
                exchangePrice === undefined)
        )
            return { reason: 'This train cannot be exchanged for that purchase.' }
        if (
            trainsCountingForLimit(this.state, this.rules, companyId).length -
                (exchanged && (this.rules.countsForLimit?.(this.state, exchanged) ?? true)
                    ? 1
                    : 0) >=
            limit
        )
            return { reason: 'The company is at its train limit.' }
        const limitReason = this.rules.limitReason?.(this.state, companyId, definitionId)
        if (limitReason) return { reason: limitReason }
        const purchaseLimit = this.rules.purchaseLimit(this.state, companyId)
        assert(
            purchaseLimit === 'unlimited' ||
                (Number.isInteger(purchaseLimit) && purchaseLimit >= 0),
            'Invalid train purchase limit'
        )
        if (purchaseLimit !== 'unlimited' && step.purchasedTrainIds.length >= purchaseLimit)
            return { reason: 'The company has used its depot purchase allowance.' }
        const price = exchangePrice ?? this.rules.depot.trainDefinition(definitionId).price
        const cash = cashOwnedBy(this.state, { kind: 'company', companyId })
        const borrowable = this.rules.borrowing?.allowed(this.state, request)
            ? this.rules.borrowing.loans.capacity(this.state, companyId)
            : 0
        if (cash === undefined || (cash !== 'unlimited' && cash + borrowable < price))
            return { reason: 'The company cannot afford this train.' }
        return {
            details: {
                companyId,
                trainId,
                definitionId,
                price,
                ...(exchangeTrainId ? { exchangeTrainId } : {})
            }
        }
    }
}
