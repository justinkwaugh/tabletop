import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { RailroadId } from '../components/railroads.js'
import type { HydratedOstbahnGameState } from '../model/gameState.js'
import { paysDividends, railroadIncome } from '../model/network.js'

export type DividendRate = Type.Static<typeof DividendRate>
export const DividendRate = Type.Object({
    railroadId: Type.Enum(RailroadId),
    perShare: Type.Number()
})

export type DividendPayout = Type.Static<typeof DividendPayout>
export const DividendPayout = Type.Object({
    playerId: Type.String(),
    amount: Type.Number()
})

export type PayDividendsMetadata = Type.Static<typeof PayDividendsMetadata>
export const PayDividendsMetadata = Type.Object({
    railroadId: Type.Enum(RailroadId),
    rates: Type.Array(DividendRate),
    payouts: Type.Array(DividendPayout)
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

    apply(state: HydratedOstbahnGameState, _context?: MachineContext) {
        const triggerId = state.dividendRailroadId
        assertExists(triggerId, 'No railroad has made a new connection')
        const rates = state.railroads.map((railroad) => {
            const income = paysDividends(railroad) ? railroadIncome(railroad) : 0
            return {
                railroadId: railroad.id,
                perShare: railroad.id === triggerId ? 2 * income : income
            }
        })
        const payouts = state.players.map((player) => ({
            playerId: player.playerId,
            amount: rates.reduce(
                (sum, rate) =>
                    sum + rate.perShare * state.sharesHeld(rate.railroadId, player.playerId),
                0
            )
        }))
        for (const payout of payouts) {
            state.getPlayerState(payout.playerId).cash += payout.amount
        }
        state.dividendRailroadId = undefined
        this.metadata = { railroadId: triggerId, rates, payouts }
    }
}
