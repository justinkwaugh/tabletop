import {
    SystemActionFirstHandler,
    actsFor,
    finiteCashOwnedBy,
    releaseTrains,
    settleCashPayments,
    stepAction,
    trainsOwnedBy,
    type EighteenXXStateHandler,
    type StepAction
} from '@tabletop/18xx'
import { ActionSource, assert, type HydratedAction } from '@tabletop/common'
import * as Type from 'typebox'
import { requireState1862, type HydratedState1862 } from './state.js'
import { systemAction, titleAction } from './titleAction.js'
import { Phases1862, bandRustsOn, trainFace } from './trains.js'

export const WarrantyCost = 50
export const MaximumWarranties = 3

/** A and D trains bought from the bank come with a free warranty (§7.10.1). */
export function freeWarranty(definitionId: string): boolean {
    const { band } = trainFace(definitionId)
    return band === 'A' || band === 'D'
}

/** Whether a train's band is retired: it rusts once it has no warranty left (§7.10, §9). */
export function retired(phaseId: string, definitionId: string): boolean {
    const rustsOn = bandRustsOn(trainFace(definitionId).band)
    return !!rustsOn && Phases1862.isAtLeast(phaseId, rustsOn)
}

/** A train's warranties, and whether they alone keep it from rusting (§7.10). */
export function trainWarranties(
    state: object,
    train: { id: string; definitionId: string }
): { count: number; lapsing: boolean } {
    const title = requireState1862(state)
    const count = title.warranties[train.id] ?? 0
    return { count, lapsing: count > 0 && retired(title.phaseId, train.definitionId) }
}

/** Warranties the company may still buy for a train it bought from the bank this turn. */
export function warrantyChoices(state: HydratedState1862, trainId: string): number[] {
    const step = state.trainPurchaseStep
    if (!step?.purchasedTrainIds.includes(trainId)) return []
    const room = MaximumWarranties - (state.warranties[trainId] ?? 0)
    const cash = finiteCashOwnedBy(state, { kind: 'company', companyId: step.companyId })
    return Array.from({ length: room }, (_, index) => index + 1).filter(
        (count) => count * WarrantyCost <= cash
    )
}

const BuyWarrantiesAction = titleAction('BuyWarranties', {
    companyId: Type.String({ minLength: 1 }),
    trainId: Type.String({ minLength: 1 }),
    count: Type.Integer({ minimum: 1, maximum: MaximumWarranties })
})
export const BuyWarranties = BuyWarrantiesAction.schema
export const isBuyWarranties = BuyWarrantiesAction.is

/** The director buys warranties, £50 each, up to three, for a train bought from the bank (§7.10). */
export class HydratedBuyWarranties extends BuyWarrantiesAction.Base {
    declare playerId: string
    declare companyId: Type.Static<typeof BuyWarranties>['companyId']
    declare trainId: Type.Static<typeof BuyWarranties>['trainId']
    declare count: Type.Static<typeof BuyWarranties>['count']
    isValid(state: HydratedState1862): boolean {
        return (
            this.source === ActionSource.User &&
            state.machineState === 'BuyingTrains' &&
            state.trainPurchaseStep?.companyId === this.companyId &&
            actsFor(state, this.playerId, this.companyId) &&
            warrantyChoices(state, this.trainId).includes(this.count)
        )
    }
    apply(state: HydratedState1862): void {
        assert(this.isValid(state), 'Warranties are bought for a train just bought from the bank')
        settleCashPayments(state, [
            {
                from: { kind: 'company', companyId: this.companyId },
                to: { kind: 'bank' },
                amount: this.count * WarrantyCost
            }
        ])
        state.warranties[this.trainId] = (state.warranties[this.trainId] ?? 0) + this.count
    }
}

export const WarrantyStep: StepAction<HydratedState1862> = stepAction(
    BuyWarrantiesAction.type,
    (action: HydratedAction): action is HydratedBuyWarranties =>
        action instanceof HydratedBuyWarranties,
    (state, playerId) => {
        const step = state.trainPurchaseStep
        return (
            !!step &&
            actsFor(state, playerId, step.companyId) &&
            step.purchasedTrainIds.some((trainId) => warrantyChoices(state, trainId).length > 0)
        )
    }
)

const Expiry = Type.Object(
    {
        expired: Type.Array(Type.String()),
        rusted: Type.Array(
            Type.Object(
                { trainId: Type.String(), definitionId: Type.String() },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)

const ExpireAction = systemAction('ExpireWarranties', {
    companyId: Type.String({ minLength: 1 }),
    metadata: Type.Optional(Expiry)
})
export const ExpireWarranties = ExpireAction.schema
export const isExpireWarranties = ExpireAction.is

/** Whether the running company has warranties to expire after this run. */
export function warrantiesDue(state: HydratedState1862): { companyId: string } | undefined {
    const companyId = state.routeStep?.companyId
    if (!companyId || !state.routeStep?.result || state.warrantiesExpired) return undefined
    return trainsOwnedBy(state, { kind: 'company', companyId }).some(
        (train) => state.warranties[train.id]
    )
        ? { companyId }
        : undefined
}

/**
 * After running, each of the company's trains loses a warranty, run or not; a retired train
 * whose last warranty goes rusts (§7.10).
 */
export class HydratedExpireWarranties extends ExpireAction.Base {
    declare companyId: Type.Static<typeof ExpireWarranties>['companyId']
    declare metadata?: Type.Static<typeof ExpireWarranties>['metadata']
    apply(state: HydratedState1862): void {
        const due = warrantiesDue(state)
        assert(
            this.source === ActionSource.System && due?.companyId === this.companyId,
            'Warranties expire once after a run'
        )
        const expired: string[] = []
        const rusted: { trainId: string; definitionId: string }[] = []
        for (const train of trainsOwnedBy(state, { kind: 'company', companyId: this.companyId })) {
            const left = state.warranties[train.id]
            if (!left) continue
            expired.push(train.id)
            if (left > 1) state.warranties[train.id] = left - 1
            else {
                delete state.warranties[train.id]
                if (retired(state.phaseId, train.definitionId))
                    rusted.push({ trainId: train.id, definitionId: train.definitionId })
            }
        }
        releaseTrains(
            state.trainInventory,
            rusted.map((train) => train.trainId),
            'removed'
        )
        state.warrantiesExpired = true
        this.metadata = { expired, rusted }
    }
}

/** Expires the running company's warranties as its earnings are distributed. */
export function expiresWarranties(
    handler: EighteenXXStateHandler<HydratedState1862>
): EighteenXXStateHandler<HydratedState1862> {
    return new SystemActionFirstHandler(handler, ExpireWarranties, (state) => warrantiesDue(state))
}

export const WarrantyActions = [
    BuyWarrantiesAction.define((action) => new HydratedBuyWarranties(action)),
    ExpireAction.define((action) => new HydratedExpireWarranties(action))
]
