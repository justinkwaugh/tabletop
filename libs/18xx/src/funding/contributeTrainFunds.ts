import { EighteenXXPlayerAction } from '../actions/eighteenXXPlayerAction.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { type GameAction, HydratableAction, assert, type HydratedGameState } from '@tabletop/common'
import {
    EmergencyTrainFunding,
    lendCash,
    type FundingState,
    type TrainFundingRules
} from './trainFunding.js'
import type { StockRules } from '../stock/stockRules.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import { Owner, sameOwner } from '../finance/finance.js'
import { settleCashPayments } from '../finance/cashPayments.js'

export const ContributeTrainFunds = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('ContributeTrainFunds'),
        owner: Owner,
        amount: Type.Integer({ minimum: 1 }),
        metadata: Type.Optional(
            Type.Object(
                {
                    /** What of the amount the owner borrowed, their own cash being spent. */
                    borrowed: Type.Integer({ minimum: 1 })
                },
                { additionalProperties: false }
            )
        )
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
    declare metadata?: ContributeTrainFunds['metadata']
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
        if (!funding.canAct(this.playerId)) return false
        const next = this.contribution(funding)
        return !!next && sameOwner(this.owner, next.owner) && this.amount === next.amount
    }
    /** The contribution due now, or one the owner may make instead of selling shares. */
    private contribution(
        funding: EmergencyTrainFunding
    ): { owner: Owner; amount: number; borrowed?: number } | undefined {
        const next = funding.next()
        if (next.kind === 'contribute') return next
        if (next.kind === 'sell' && next.borrowInstead)
            return { owner: next.owner, ...next.borrowInstead }
        return undefined
    }
    apply(state: HydratedGameState & FundingState): void {
        assert(this.isValid(state), 'Invalid ContributeTrainFunds action')
        const funding = new EmergencyTrainFunding(state, this.#rules, this.#stocks, this.#trains)
        const next = this.contribution(funding)
        assert(next && state.trainFunding, 'Funding requires an owner contribution')
        if (next.borrowed) {
            lendCash(state, next.owner, next.borrowed)
            this.#rules.recordLoan?.(state, next.owner, next.borrowed)
            this.metadata = { borrowed: next.borrowed }
        }
        settleCashPayments(state, [
            {
                from: next.owner,
                to: { kind: 'company', companyId: state.trainFunding.purchase.companyId },
                amount: next.amount
            }
        ])
    }
}
