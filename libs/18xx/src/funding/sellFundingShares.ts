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
import { ShareSale, ShareSaleDetails } from '../stock/shareSale.js'
import { Owner, sameOwner, cashOwnedBy } from '../finance/finance.js'

const FundingShareSaleDetails = Type.Object(
    {
        ...ShareSaleDetails.properties,
        requiredContribution: Type.Integer({ minimum: 0 }),
        cashShortfall: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)
type FundingShareSaleDetails = Type.Static<typeof FundingShareSaleDetails>

export const SellFundingShares = Type.Object(
    {
        ...PlayerAction.properties,
        ...ShareSale.properties,
        type: Type.Literal('SellFundingShares'),
        seller: Owner,
        expectedProceeds: Type.Integer({ minimum: 1 }),
        metadata: Type.Optional(FundingShareSaleDetails)
    },
    { additionalProperties: false }
)
export type SellFundingShares = Type.Static<typeof SellFundingShares>
const SellFundingSharesValidator = Compile(SellFundingShares)
export function isSellFundingShares(action: GameAction): action is SellFundingShares {
    return (
        action instanceof HydratedSellFundingShares ||
        (action.type === 'SellFundingShares' && SellFundingSharesValidator.Check(action))
    )
}
export class HydratedSellFundingShares
    extends HydratableAction<typeof SellFundingShares>
    implements SellFundingShares
{
    declare type: 'SellFundingShares'
    declare playerId: string
    declare seller: Owner
    declare companyId: string
    declare shares: number
    declare expectedProceeds: number
    declare metadata?: FundingShareSaleDetails
    readonly #rules: TrainFundingRules
    readonly #stocks: StockRules
    readonly #trains: TrainRules
    constructor(
        data: SellFundingShares,
        rules: TrainFundingRules,
        stocks: StockRules,
        trains: TrainRules
    ) {
        super(
            data instanceof HydratedSellFundingShares ? data.dehydrate() : data,
            SellFundingSharesValidator
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
            next.kind === 'sell' &&
            sameOwner(next.owner, this.seller) &&
            next.sales.some(
                (sale) =>
                    sale.proceeds === this.expectedProceeds &&
                    sale.sales[0].companyId === this.companyId &&
                    sale.sales[0].shares === this.shares
            )
        )
    }
    apply(state: HydratedGameState & FundingState): void {
        assert(this.isValid(state), 'Invalid SellFundingShares action')
        const funding = new EmergencyTrainFunding(state, this.#rules, this.#stocks, this.#trains)
        const next = funding.next()
        assert(next.kind === 'sell', 'Funding requires an owner share sale')
        const details = next.sales.find(
            (sale) =>
                sale.sales[0].companyId === this.companyId && sale.sales[0].shares === this.shares
        )
        assert(details, 'Funding sale requires a settlement')
        const requiredContribution = funding.shortfall()
        const cash = cashOwnedBy(state, this.seller)
        assert(typeof cash === 'number', 'Funding requires a finite contributor balance')
        const cashShortfall = Math.max(0, requiredContribution - cash)
        funding.applySale(details)
        this.metadata = { ...details, requiredContribution, cashShortfall }
    }
}
