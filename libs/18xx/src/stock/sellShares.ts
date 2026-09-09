import { recordStockAction } from './stockRoundRules.js'
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
import { Owner } from '../finance/finance.js'
import { settleCashPayments } from '../finance/cashPayments.js'
import { applyPresidencyChange } from './presidency.js'
import { placeStockMarker } from './stockMarket.js'
import {
    ShareSale,
    ShareSaleDetails,
    evaluateShareSale,
    transferSaleCertificates
} from './shareSale.js'
import type { StockRules } from './stockRules.js'
import type { StockState } from './stockState.js'

export const SellShares = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('SellShares'),
        seller: Owner,
        sales: Type.Array(ShareSale, { minItems: 1 }),
        expectedProceeds: Type.Integer({ minimum: 1 }),
        metadata: Type.Optional(ShareSaleDetails)
    },
    { additionalProperties: false }
)
export type SellShares = Type.Static<typeof SellShares>
const Validator = Compile(SellShares)
export function isSellShares(action: GameAction): action is SellShares {
    return (
        action instanceof HydratedSellShares ||
        (action.type === 'SellShares' && Validator.Check(action))
    )
}
export class HydratedSellShares extends HydratableAction<typeof SellShares> implements SellShares {
    declare type: 'SellShares'
    declare playerId: string
    declare seller: Owner
    declare sales: ShareSale[]
    declare expectedProceeds: number
    declare metadata?: ShareSaleDetails
    readonly #rules: StockRules
    constructor(data: SellShares, rules: StockRules) {
        super(data instanceof HydratedSellShares ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & StockState): void {
        assert(this.source === ActionSource.User, 'Share sales require a player action')
        const result = evaluateShareSale(state, this, this.#rules)
        assert(result.details, result.reason ?? 'Invalid sale')
        assert(this.expectedProceeds === result.details.proceeds, 'Sale proceeds have changed')
        settleCashPayments(state, result.details.payments)
        for (const sale of result.details.sales) {
            if (sale.presidency) applyPresidencyChange(state, sale.presidency)
            transferSaleCertificates(state, sale)
            placeStockMarker(state.stockMarket, sale.companyId, sale.toMarketSpaceId)
            state.stockRound.sales.push({ owner: this.seller, companyId: sale.companyId })
            state.stockRound.turn.companiesSold.push(sale.companyId)
        }
        recordStockAction(state, this.playerId, this.#rules.round)
        this.metadata = result.details
    }
}
