import { EighteenXXPlayerAction } from '../actions/eighteenXXPlayerAction.js'
import { recordStockRoundSale } from './stockRound.js'
import { recordStockAction } from './stockRoundRules.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { Owner, sameOwner } from '../finance/finance.js'
import {
    ShareSale,
    ShareSaleDetails,
    evaluateShareSale,
    applyShareSale,
    extendedSaleBlock
} from './shareSale.js'
import type { StockRules } from './stockRules.js'
import type { StockState } from './stockState.js'

export const SellShares = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('SellShares'),
        seller: Owner,
        sales: Type.Array(ShareSale, { minItems: 1, maxItems: 1 }),
        expectedProceeds: Type.Integer({ minimum: 1 }),
        metadata: Type.Optional(
            Type.Object(
                { ...ShareSaleDetails.properties, saleBlockId: Type.Optional(Type.String()) },
                { additionalProperties: false }
            )
        )
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
    declare metadata?: SellShares['metadata']
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
        let saleBlockId: string | undefined
        if (this.#rules.repeatSales === 'extend-block') {
            const sale = result.details.sales[0]
            const blocks = (state.stockRound.turn.saleBlocks ??= [])
            const previous = blocks.find(
                (block) =>
                    block.companyId === sale.companyId && sameOwner(block.seller, this.seller)
            )
            const block = extendedSaleBlock(
                state,
                this.#rules.saleTerms,
                this.seller,
                sale,
                previous
            )
            if (previous) {
                Object.assign(previous, block)
                saleBlockId = previous.id
            } else {
                saleBlockId = this.id
                blocks.push({
                    id: this.id,
                    companyId: sale.companyId,
                    seller: this.seller,
                    ...block
                })
            }
        }
        applyShareSale(state, result.details)
        this.#rules.afterSale?.(state, result.details)
        for (const sale of result.details.sales) {
            recordStockRoundSale(state.stockRound, this.seller, sale.companyId)
            if (!state.stockRound.turn.companiesSold.includes(sale.companyId))
                state.stockRound.turn.companiesSold.push(sale.companyId)
        }
        recordStockAction(state, this.playerId, this.#rules.round)
        this.metadata = { ...result.details, ...(saleBlockId ? { saleBlockId } : {}) }
    }
}
