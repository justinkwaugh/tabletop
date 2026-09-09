import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    assertExists,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { Owner } from '../finance/finance.js'
import {
    evaluateSharePurchase,
    settleCashPayments,
    SharePurchaseDetails,
    type SharePurchaseRules,
    type SharePurchaseState
} from './sharePurchase.js'

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
    readonly #rules: SharePurchaseRules
    constructor(data: BuyShares, rules: SharePurchaseRules) {
        super(data instanceof HydratedBuyShares ? data.dehydrate() : data, BuySharesValidator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & SharePurchaseState): void {
        assert(this.source === ActionSource.User, 'A share purchase requires a player action')
        const result = evaluateSharePurchase(state, this, this.#rules)
        assert(result.details, result.reason ?? 'Invalid purchase')
        assert(this.expectedPrice === result.details.price, 'The purchase price has changed')
        const certificate = state.certificates.find(
            (certificate) => certificate.id === this.certificateId
        )
        assertExists(certificate, 'Missing purchased certificate')
        assert(!certificate.retired, 'Cannot buy a retired certificate')
        settleCashPayments(state, result.details.payments)
        certificate.owner = this.buyer
        delete certificate.poolId
        if (this.buyer.kind === 'company')
            state.stockRound.companyPurchases.push(this.buyer.companyId)
        this.metadata = result.details
    }
}
