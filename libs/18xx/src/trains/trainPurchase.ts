import type { MapStateData } from '../map/mapState.js'
import * as Type from 'typebox'
import { assert } from '@tabletop/common'
import { cashOwnedBy, controllingOwner, getCompany } from '../finance/finance.js'
import { trainsOwnedBy, trainCanBeTraded, type Train, type TrainPurchaseState } from './train.js'
import type { TrainDepot } from './trainDepot.js'
export interface TrainRules {
    depot: TrainDepot
    exchangePrice(
        state: TrainPurchaseState,
        companyId: string,
        definitionId: string,
        train: Train
    ): number | undefined
    requiresTrain(state: TrainPurchaseState & MapStateData, companyId: string): boolean
    availableDefinitions(state: TrainPurchaseState): string[]
    phaseAfterPurchase(state: TrainPurchaseState, definitionId: string): string
    trainLimit(state: TrainPurchaseState, companyId: string): number
    purchaseLimit(state: TrainPurchaseState, companyId: string): number | 'unlimited'
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
    | { details: TrainPurchaseDetails; reason?: never }
    | { details?: never; reason: string }
export class TrainPurchase {
    constructor(
        private readonly state: TrainPurchaseState,
        private readonly rules: TrainRules
    ) {}
    canAct(playerId: string, companyId: string): boolean {
        return (
            this.state.trainPurchaseStep?.companyId === companyId &&
            !getCompany(this.state, companyId).closed &&
            controllingOwner(this.state, companyId)?.playerId === playerId
        )
    }
    offers(): {
        definitionId: string
        remaining: number | 'unlimited'
        evaluation: TrainPurchaseEvaluation
    }[] {
        return this.rules.depot.definition.supply.map(({ definitionId }) => {
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
    marketOffers(): TrainPurchaseEvaluation[] {
        const companyId = this.state.trainPurchaseStep?.companyId
        return companyId
            ? this.state.trainInventory.trains
                  .filter((train) => train.status === 'market')
                  .map((train) =>
                      this.evaluate({
                          companyId,
                          trainId: train.id,
                          definitionId: train.definitionId
                      })
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
                train.definitionId === definitionId &&
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
            trainsOwnedBy(this.state, { kind: 'company', companyId }).length -
                (exchanged ? 1 : 0) >=
            limit
        )
            return { reason: 'The company is at its train limit.' }
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
        if (cash === undefined || (cash !== 'unlimited' && cash < price))
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
