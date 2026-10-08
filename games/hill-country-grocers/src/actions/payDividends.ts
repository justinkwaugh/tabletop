import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedHcgGameState } from '../model/gameState.js'
import { CompanyDividend, Payout, companyDividends, payShareholders } from '../model/payouts.js'

export type PayDividendsMetadata = Type.Static<typeof PayDividendsMetadata>
export const PayDividendsMetadata = Type.Object({
    final: Type.Boolean(),
    dividendNumber: Type.Number(),
    dividends: Type.Array(CompanyDividend),
    payouts: Type.Array(Payout)
})

export type PayDividends = Type.Static<typeof PayDividends>
export const PayDividends = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.PayDividends),
            metadata: Type.Optional(PayDividendsMetadata)
        })
    ])
)

export const PayDividendsValidator = Compile(PayDividends)

export function isPayDividends(action?: GameAction): action is PayDividends {
    return action?.type === ActionType.PayDividends
}

export class HydratedPayDividends
    extends HydratableAction<typeof PayDividends>
    implements PayDividends
{
    declare type: ActionType.PayDividends
    declare metadata?: PayDividendsMetadata

    constructor(data: PayDividends) {
        super(data, PayDividendsValidator)
    }

    apply(state: HydratedHcgGameState, _context?: MachineContext) {
        const final = state.isGameEndTriggered()
        const dividends = companyDividends(state)
        const payouts = payShareholders(state, dividends)
        if (!final) {
            state.roundTrack = []
        }
        state.dividendsPaid += 1
        this.metadata = { final, dividendNumber: state.dividendsPaid, dividends, payouts }
    }
}
