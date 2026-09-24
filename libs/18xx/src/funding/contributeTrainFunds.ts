import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    type GameAction,
    HydratableAction,
    assert,
    type HydratedGameState
} from '@tabletop/common'
import { EmergencyTrainFunding, type FundingState, type TrainFundingRules } from './trainFunding.js'
import type { StockRules } from '../stock/stockRules.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import { Owner, sameOwner } from '../finance/finance.js'
import { settleCashPayments } from '../finance/cashPayments.js'

export const ContributeTrainFunds = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('ContributeTrainFunds'),
        owner: Owner,
        amount: Type.Integer({ minimum: 1 })
    },
    { additionalProperties: false }
)
export type ContributeTrainFunds = Type.Static<typeof ContributeTrainFunds>
const ContributeTrainFundsValidator = Compile(ContributeTrainFunds)
export function isContributeTrainFunds(action: GameAction): action is ContributeTrainFunds {
    return (
        action instanceof HydratedContributeTrainFunds ||
        (action.type === 'ContributeTrainFunds' && ContributeTrainFundsValidator.Check(action))
    )
}
export class HydratedContributeTrainFunds
    extends HydratableAction<typeof ContributeTrainFunds>
    implements ContributeTrainFunds
{
    declare type: 'ContributeTrainFunds'
    declare playerId: string
    declare owner: Owner
    declare amount: number
    readonly #rules: TrainFundingRules
    readonly #stocks: StockRules
    readonly #trains: TrainRules
    constructor(
        data: ContributeTrainFunds,
        rules: TrainFundingRules,
        stocks: StockRules,
        trains: TrainRules
    ) {
        super(
            data instanceof HydratedContributeTrainFunds ? data.dehydrate() : data,
            ContributeTrainFundsValidator
        )
        this.#rules = rules
        this.#stocks = stocks
        this.#trains = trains
    }
    isValid(state: FundingState): boolean {
        const funding = new EmergencyTrainFunding(state, this.#rules, this.#stocks, this.#trains)
        if (this.source !== ActionSource.User || !funding.canAct(this.playerId)) return false
        const next = funding.next()
        return (
            next.kind === 'contribute' &&
            sameOwner(this.owner, next.owner) &&
            this.amount === next.amount
        )
    }
    apply(state: HydratedGameState & FundingState): void {
        assert(this.isValid(state), 'Invalid ContributeTrainFunds action')
        const funding = new EmergencyTrainFunding(state, this.#rules, this.#stocks, this.#trains)
        const next = funding.next()
        assert(
            next.kind === 'contribute' && state.trainFunding,
            'Funding requires an owner contribution'
        )
        settleCashPayments(state, [
            {
                from: next.owner,
                to: { kind: 'company', companyId: state.trainFunding.purchase.companyId },
                amount: next.amount
            }
        ])
    }
}
