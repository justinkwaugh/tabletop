import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { RailroadId } from '../maps/types.js'
import type { HydratedSarGameState } from '../model/gameState.js'
import { Payout, payLeaveTownCubes, payShareholders } from '../model/payouts.js'

export type RailroadDividend = Type.Static<typeof RailroadDividend>
export const RailroadDividend = Type.Object({
    railroadId: Type.Enum(RailroadId),
    perShare: Type.Number()
})

export type PayDividendsMetadata = Type.Static<typeof PayDividendsMetadata>
export const PayDividendsMetadata = Type.Object({
    final: Type.Boolean(),
    dividendNumber: Type.Number(),
    rates: Type.Array(RailroadDividend),
    payouts: Type.Array(Payout),
    leaveTownPayouts: Type.Array(Payout)
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

    apply(state: HydratedSarGameState, _context?: MachineContext) {
        const final = state.isFinalPayoffNext()
        const rates = state.openRailroads().map((railroad) => ({
            railroadId: railroad.id,
            perShare: final
                ? state.finalPayoffPerShare(railroad.id)
                : state.dividendPerShare(railroad.id)
        }))
        const payouts = payShareholders(state, rates)
        const leaveTownPayouts = payLeaveTownCubes(state)
        if (final) {
            for (const railroad of state.railroads) {
                railroad.treasury = 0
            }
        }
        state.actionTrack = 0
        state.dividendsPaid += 1
        this.metadata = {
            final,
            dividendNumber: state.dividendsPaid,
            rates,
            payouts,
            leaveTownPayouts
        }
    }
}
