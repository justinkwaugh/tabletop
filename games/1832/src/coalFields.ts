import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedAction
} from '@tabletop/common'
import {
    CashPayment,
    StopRights,
    settleCashPayments,
    stepAction,
    EighteenXXPlayerAction
} from '@tabletop/18xx'
import type { TitleStepAction } from './titleActions.js'
import { CoalAccess } from './coalAccess.js'
import type { HydratedEighteenThirtyTwoState } from './state.js'
import { EighteenThirtyTwoTrackRules } from './trackRules.js'

export const CoalFieldsPrivateId = 'P5'

// $80, half to the company owning the open private (§6.5.2); buying one uses a yellow tile lay, and
// the company buying the private takes a token free, keeping it when the private closes (§16.2 P5).
export const CoalRights = new StopRights({
    access: CoalAccess,
    privateCompanyId: CoalFieldsPrivateId,
    price: 80,
    track: EighteenThirtyTwoTrackRules
})

export const BuyCoalRights = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('BuyCoalRights'),
        companyId: Type.String(),
        metadata: Type.Optional(
            Type.Object({ payments: Type.Array(CashPayment) }, { additionalProperties: false })
        )
    },
    { additionalProperties: false }
)
export type BuyCoalRights = Type.Static<typeof BuyCoalRights>
const Validator = Compile(BuyCoalRights)
export function isBuyCoalRights(action: GameAction): action is BuyCoalRights {
    return (
        action instanceof HydratedBuyCoalRights ||
        (action.type === 'BuyCoalRights' && Validator.Check(action))
    )
}

export class HydratedBuyCoalRights
    extends HydratableAction<typeof BuyCoalRights>
    implements BuyCoalRights
{
    declare type: 'BuyCoalRights'
    declare playerId: string
    declare companyId: string
    declare metadata?: BuyCoalRights['metadata']
    constructor(data: BuyCoalRights) {
        super(data instanceof HydratedBuyCoalRights ? data.dehydrate() : data, Validator)
    }
    isValid(state: HydratedEighteenThirtyTwoState): boolean {
        return (
            this.source === ActionSource.User &&
            state.trackStep?.companyId === this.companyId &&
            CoalRights.canBuy(state, this.playerId)
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        assert(this.isValid(state), 'The company cannot buy a WVCF token now')
        const payments = CoalRights.payments(state, this.companyId)
        settleCashPayments(state, payments)
        CoalAccess.grant(state, this.companyId)
        state.coalTokenBought = true
        this.metadata = { payments }
    }
}

export const BuyCoalRightsStep: TitleStepAction = stepAction(
    'BuyCoalRights',
    (action: HydratedAction) => action instanceof HydratedBuyCoalRights,
    (state, playerId) => CoalRights.canBuy(state, playerId)
)
