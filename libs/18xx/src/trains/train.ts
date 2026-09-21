import * as Type from 'typebox'
import { Owner, type FinancialState, sameOwner } from '../finance/finance.js'
import { assert } from '@tabletop/common'
const Id = Type.String({ minLength: 1 })
export const TrainDistance = Type.Object(
    {
        measure: Type.Union([
            Type.Literal('hex-edges'),
            Type.Literal('revenue-centers'),
            Type.Literal('cities-and-offboards')
        ]),
        maximum: Type.Union([Type.Integer({ minimum: 1 }), Type.Literal('unlimited')])
    },
    { additionalProperties: false }
)
export type TrainDistance = Type.Static<typeof TrainDistance>
export const TrainDefinition = Type.Object(
    {
        id: Id,
        name: Id,
        price: Type.Integer({ minimum: 0 }),
        distance: TrainDistance
    },
    { additionalProperties: false }
)
export type TrainDefinition = Type.Static<typeof TrainDefinition>
const Identity = { id: Id, definitionId: Id, hasRun: Type.Optional(Type.Boolean()) }
export const Train = Type.Union([
    Type.Object({ ...Identity, status: Type.Literal('depot') }, { additionalProperties: false }),
    Type.Object({ ...Identity, status: Type.Literal('market') }, { additionalProperties: false }),
    Type.Object(
        {
            ...Identity,
            status: Type.Literal('owned'),
            owner: Owner,
            rustsAfterOperation: Type.Optional(Type.Literal(true))
        },
        { additionalProperties: false }
    ),
    Type.Object({ ...Identity, status: Type.Literal('removed') }, { additionalProperties: false })
])
export type Train = Type.Static<typeof Train>
export const TrainInventory = Type.Object(
    {
        depotId: Id,
        trains: Type.Array(Train),
        nextTrainNumber: Type.Integer({ minimum: 1 })
    },
    { additionalProperties: false }
)
export type TrainInventory = Type.Static<typeof TrainInventory>
export const TrainPurchaseStep = Type.Object(
    { companyId: Id, purchasedTrainIds: Type.Array(Id, { uniqueItems: true }) },
    { additionalProperties: false }
)
export type TrainPurchaseStep = Type.Static<typeof TrainPurchaseStep>
export const TrainFields = {
    trainInventory: TrainInventory,
    trainPurchaseStep: Type.Optional(TrainPurchaseStep)
}
export type TrainState = Type.Static<Type.TObject<typeof TrainFields>>
export type TrainPurchaseState = FinancialState & TrainState & { phaseId: string }
export function trainsOwnedBy(state: TrainState, owner: Owner): Train[] {
    return state.trainInventory.trains.filter(
        (train) => train.status === 'owned' && sameOwner(train.owner, owner)
    )
}

export function trainCanBeTraded(train: Train): boolean {
    return train.status === 'owned' && !train.rustsAfterOperation
}

export function unownedTrain(train: Train, status: 'market' | 'removed'): Train {
    return {
        id: train.id,
        definitionId: train.definitionId,
        status,
        ...(train.hasRun === undefined ? {} : { hasRun: train.hasRun })
    }
}

export function validateTrainPurchaseStep(state: {
    machineState: string
    trainPurchaseStep?: TrainPurchaseStep
    operatingSet?: { companyOrder: readonly string[] }
}): void {
    if (state.machineState !== 'BuyingTrains') return
    assert(
        state.trainPurchaseStep &&
            state.operatingSet?.companyOrder.includes(state.trainPurchaseStep.companyId),
        'Train purchases require an operating company'
    )
}
