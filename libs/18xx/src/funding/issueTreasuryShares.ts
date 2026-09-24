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
import { ShareSaleDetails } from '../stock/shareSale.js'

export const IssueTreasuryShares = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('IssueTreasuryShares'),
        expectedProceeds: Type.Integer({ minimum: 1 }),
        metadata: Type.Optional(ShareSaleDetails)
    },
    { additionalProperties: false }
)
export type IssueTreasuryShares = Type.Static<typeof IssueTreasuryShares>
const IssueTreasurySharesValidator = Compile(IssueTreasuryShares)
export function isIssueTreasuryShares(action: GameAction): action is IssueTreasuryShares {
    return (
        action instanceof HydratedIssueTreasuryShares ||
        (action.type === 'IssueTreasuryShares' && IssueTreasurySharesValidator.Check(action))
    )
}
export class HydratedIssueTreasuryShares
    extends HydratableAction<typeof IssueTreasuryShares>
    implements IssueTreasuryShares
{
    declare type: 'IssueTreasuryShares'
    declare playerId: string
    declare expectedProceeds: number
    declare metadata?: ShareSaleDetails
    readonly #rules: TrainFundingRules
    readonly #stocks: StockRules
    readonly #trains: TrainRules
    constructor(
        data: IssueTreasuryShares,
        rules: TrainFundingRules,
        stocks: StockRules,
        trains: TrainRules
    ) {
        super(
            data instanceof HydratedIssueTreasuryShares ? data.dehydrate() : data,
            IssueTreasurySharesValidator
        )
        this.#rules = rules
        this.#stocks = stocks
        this.#trains = trains
    }
    isValid(state: FundingState): boolean {
        const funding = new EmergencyTrainFunding(state, this.#rules, this.#stocks, this.#trains)
        if (this.source !== ActionSource.User || !funding.canAct(this.playerId)) return false
        const next = funding.next()
        return next.kind === 'issue' && next.details.proceeds === this.expectedProceeds
    }
    apply(state: HydratedGameState & FundingState): void {
        assert(this.isValid(state), 'Invalid IssueTreasuryShares action')
        const funding = new EmergencyTrainFunding(state, this.#rules, this.#stocks, this.#trains)
        const next = funding.next()
        assert(next.kind === 'issue', 'Funding requires treasury issuance')
        funding.applySale(next.details)
        this.metadata = next.details
    }
}
