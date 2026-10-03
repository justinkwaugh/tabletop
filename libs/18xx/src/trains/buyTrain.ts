import { CompanyChanges, CompanyChangeRecorder } from '../company/companyChanges.js'
import { preparePhaseChange, type PhaseState } from '../phases/phaseChange.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { settleCashPayments, type CashPayment } from '../finance/cashPayments.js'
import {
    TrainPurchase,
    TrainPurchaseRequest,
    TrainPurchaseDetails,
    type TrainRules
} from './trainPurchase.js'
import { unownedTrain, type TrainPurchaseState } from './train.js'
import { getCompany } from '../finance/finance.js'
import { closePrivate } from '../privates/privateCompany.js'
import {
    DeparturePayments,
    departurePaymentsField,
    settleTrainDepartures
} from './trainDepartures.js'
export const BuyTrain = Type.Object(
    {
        ...PlayerAction.properties,
        ...TrainPurchaseRequest.properties,
        type: Type.Literal('BuyTrain'),
        expectedPrice: Type.Integer({ minimum: 0 }),
        metadata: Type.Optional(
            Type.Object(
                {
                    ...TrainPurchaseDetails.properties,
                    companyChanges: Type.Optional(CompanyChanges),
                    departurePayments: DeparturePayments
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type BuyTrain = Type.Static<typeof BuyTrain>
const Validator = Compile(BuyTrain)
export function isBuyTrain(action: GameAction): action is BuyTrain {
    return (
        action instanceof HydratedBuyTrain ||
        (action.type === 'BuyTrain' && Validator.Check(action))
    )
}
export class HydratedBuyTrain extends HydratableAction<typeof BuyTrain> implements BuyTrain {
    declare type: 'BuyTrain'
    declare playerId: string
    declare companyId: string
    declare trainId: string
    declare definitionId: string
    declare exchangeTrainId?: string
    declare expectedPrice: number
    declare metadata?: BuyTrain['metadata']
    readonly #rules: TrainRules
    constructor(data: BuyTrain, rules: TrainRules) {
        super(data instanceof HydratedBuyTrain ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & TrainPurchaseState & PhaseState): void {
        const purchase = new TrainPurchase(state, this.#rules)
        assert(
            this.source === ActionSource.User &&
                state.activePlayerIds.includes(this.playerId) &&
                purchase.canAct(this.playerId, this.companyId),
            'Only the operating company’s controlling owner may buy trains'
        )
        const result = purchase.evaluate(this)
        assert(result.details, result.reason ?? 'Invalid train purchase')
        assert(result.details.price === this.expectedPrice, 'Train price has changed')
        const companies = new CompanyChangeRecorder(state)
        const payments = applyTrainPurchase(state, result.details, this.#rules)
        this.metadata = {
            companyChanges: companies.changes(state),
            ...result.details,
            ...departurePaymentsField(payments)
        }
    }
}

export function applyTrainPurchase(
    state: TrainPurchaseState & PhaseState & { machineState: string },
    details: TrainPurchaseDetails,
    rules: TrainRules
): CashPayment[] {
    settleCashPayments(state, [
        {
            from: { kind: 'company', companyId: details.companyId },
            to: { kind: 'bank' },
            amount: details.price
        }
    ])
    if (details.exchangeTrainId)
        state.trainInventory.trains = state.trainInventory.trains.map((train) =>
            train.id === details.exchangeTrainId ? unownedTrain(train, 'market') : train
        )
    const toPhaseId = rules.phaseAfterPurchase(state, details.definitionId)
    const payments = settleTrainDepartures(state, rules, [
        { trainId: details.trainId, definitionId: details.definitionId, cause: 'purchase' }
    ])
    rules.depot.purchase(state.trainInventory, details.trainId, details.definitionId, {
        kind: 'company',
        companyId: details.companyId
    })
    if (state.trainPurchaseStep?.companyId === details.companyId)
        state.trainPurchaseStep.purchasedTrainIds.push(details.trainId)
    closePrivatesOnTrainPurchase(state, rules, details.companyId)
    preparePhaseChange(state, details.trainId, details.definitionId, toPhaseId, {
        machineState: state.machineState,
        companyId: details.companyId
    })
    return payments
}

export function closePrivatesOnTrainPurchase(
    state: TrainPurchaseState,
    rules: TrainRules,
    companyId: string
): void {
    for (const privateCompanyId of rules.privatesClosedByPurchase?.(state, companyId) ?? []) {
        assert(
            !getCompany(state, privateCompanyId).closed,
            'Only an open private closes on a train purchase'
        )
        closePrivate(state, privateCompanyId)
    }
}
