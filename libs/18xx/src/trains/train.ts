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
        distance: TrainDistance,
        rustsOn: Type.Optional(Id)
    },
    { additionalProperties: false }
)
export type TrainDefinition = Type.Static<typeof TrainDefinition>
const Identity = { id: Id, definitionId: Id }
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
    )
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

/** Where trains go when they leave a company: the bank's market, or out of play. */
export type TrainDestination = 'market' | 'removed'

export function releaseTrains(
    inventory: TrainInventory,
    ids: readonly string[],
    destination: TrainDestination
): void {
    inventory.trains =
        destination === 'removed'
            ? inventory.trains.filter((train) => !ids.includes(train.id))
            : inventory.trains.map((train) =>
                  ids.includes(train.id) ? unownedTrain(train) : train
              )
}

export function unownedTrain(train: Train): Train {
    return { id: train.id, definitionId: train.definitionId, status: 'market' }
}

export function validateTrainPurchaseStep(state: {
    machineState: string
    trainPurchaseStep?: TrainPurchaseStep
    operatingSet?: { companyOrder: readonly string[] }
}): void {
    // Entering the step can be deferred while a game end is scheduled, so the step may not exist yet.
    if (state.machineState !== 'BuyingTrains' || !state.trainPurchaseStep) return
    assert(
        state.operatingSet?.companyOrder.includes(state.trainPurchaseStep.companyId),
        'Train purchases require an operating company'
    )
}
