import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import type { RailroadId } from '../components/railroads.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedPromontoryPointGameState } from '../model/gameState.js'
import { RailroadIdSchema } from '../model/schemas.js'
import { sellShareRefusal, sharePrice, tradingTurn } from '../rules/trading.js'

export type SellShareMetadata = Type.Static<typeof SellShareMetadata>
export const SellShareMetadata = Type.Object({
    price: Type.Integer({ minimum: 0 })
})

export type SellShare = Type.Static<typeof SellShare>
export const SellShare = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type', 'playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SellShare),
            playerId: Type.String(),
            railroadId: RailroadIdSchema,
            metadata: Type.Optional(SellShareMetadata)
        })
    ])
)

export const SellShareValidator = Compile(SellShare)

export function isSellShare(action?: GameAction): action is SellShare {
    return action?.type === ActionType.SellShare
}

// R-3.2, R-3.2-H1, R-2.2: one of the turn's two trades, even for nothing at 0; no price moves.
export class HydratedSellShare extends HydratableAction<typeof SellShare> implements SellShare {
    declare type: ActionType.SellShare
    declare playerId: string
    declare railroadId: RailroadId
    declare metadata?: SellShareMetadata

    constructor(data: SellShare) {
        super(data, SellShareValidator)
    }

    apply(state: HydratedPromontoryPointGameState, _context?: MachineContext) {
        const refusal = sellShareRefusal(state, this.playerId, this.railroadId)
        if (refusal !== undefined) {
            throw new Error(`SellShare refused: ${refusal}`)
        }
        const price = sharePrice(state, this.railroadId)
        const player = state.getPlayerState(this.playerId)
        player.money += price
        player.shares[this.railroadId] -= 1
        tradingTurn(state).tradesUsed += 1
        this.metadata = { price }
    }
}
