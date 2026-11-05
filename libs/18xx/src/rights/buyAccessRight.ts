import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    assert,
    assertExists,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { EighteenXXPlayerAction } from '../actions/eighteenXXPlayerAction.js'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import type { FinancialState } from '../finance/finance.js'
import {
    accessRightPurchase,
    type AccessRightPurchaseState,
    type AccessRightRules
} from './accessRights.js'

export const BuyAccessRight = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('BuyAccessRight'),
        companyId: Type.String(),
        rightId: Type.String(),
        expectedPrice: Type.Integer({ minimum: 0 }),
        metadata: Type.Optional(
            Type.Object({ payments: Type.Array(CashPayment) }, { additionalProperties: false })
        )
    },
    { additionalProperties: false }
)
export type BuyAccessRight = Type.Static<typeof BuyAccessRight>
const Validator = Compile(BuyAccessRight)
export function isBuyAccessRight(action: GameAction): action is BuyAccessRight {
    return (
        action instanceof HydratedBuyAccessRight ||
        (action.type === 'BuyAccessRight' && Validator.Check(action))
    )
}

type State = AccessRightPurchaseState & FinancialState

export class HydratedBuyAccessRight
    extends HydratableAction<typeof BuyAccessRight>
    implements BuyAccessRight
{
    declare type: 'BuyAccessRight'
    declare playerId: string
    declare companyId: string
    declare rightId: string
    declare expectedPrice: number
    declare metadata?: BuyAccessRight['metadata']
    readonly #rules: AccessRightRules
    constructor(data: BuyAccessRight, rules: AccessRightRules) {
        super(data instanceof HydratedBuyAccessRight ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    isValid(state: State): boolean {
        if (this.source !== ActionSource.User) return false
        const purchase = accessRightPurchase(
            state,
            this.#rules,
            this.playerId,
            this.companyId,
            this.rightId
        )
        return 'price' in purchase && purchase.price === this.expectedPrice
    }
    apply(state: HydratedGameState & State): void {
        assert(this.isValid(state), 'The company cannot buy this right now')
        const payments: CashPayment[] = this.expectedPrice
            ? [
                  {
                      from: { kind: 'company', companyId: this.companyId },
                      to: { kind: 'bank' },
                      amount: this.expectedPrice
                  }
              ]
            : []
        assertExists(state.accessRights, 'A title with rights records them')
        settleCashPayments(state, payments)
        state.accessRights.push({ rightId: this.rightId, companyId: this.companyId })
        this.metadata = { payments }
    }
}
