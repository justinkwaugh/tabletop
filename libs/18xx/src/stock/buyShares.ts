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
import { evaluateSharePurchase, SharePurchaseDetails, applySharePurchase } from './sharePurchase.js'
import type { StockRules } from './stockRules.js'
import type { StockState } from './stockState.js'

export const BuyShares = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('BuyShares'),
        buyer: Owner,
        certificateId: Type.String(),
        expectedPrice: Type.Integer({ minimum: 1 }),
        metadata: Type.Optional(SharePurchaseDetails)
    },
    { additionalProperties: false }
)
export type BuyShares = Type.Static<typeof BuyShares>
const BuySharesValidator = Compile(BuyShares)
export function isBuyShares(action: GameAction): action is BuyShares {
    return (
        action instanceof HydratedBuyShares ||
        (action.type === 'BuyShares' && BuySharesValidator.Check(action))
    )
}

export class HydratedBuyShares extends HydratableAction<typeof BuyShares> implements BuyShares {
    declare type: 'BuyShares'
    declare playerId: string
    declare buyer: Owner
    declare certificateId: string
    declare expectedPrice: number
    declare metadata?: SharePurchaseDetails
    readonly #rules: StockRules
    constructor(data: BuyShares, rules: StockRules) {
        super(data instanceof HydratedBuyShares ? data.dehydrate() : data, BuySharesValidator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & StockState): void {
        assert(this.source === ActionSource.User, 'A share purchase requires a player action')
        const result = evaluateSharePurchase(state, this, this.#rules)
        assert(result.details, result.reason ?? 'Invalid purchase')
        assert(this.expectedPrice === result.details.price, 'The purchase price has changed')
        applySharePurchase(state, result.details)
        this.metadata = result.details
    }
}
