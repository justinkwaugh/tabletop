import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import type { RailroadId } from '../components/railroads.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedPromontoryPointGameState } from '../model/gameState.js'
import { RailroadIdSchema } from '../model/schemas.js'
import { buyShareRefusal, sharePrice } from '../rules/trading.js'

export type BuyShareMetadata = Type.Static<typeof BuyShareMetadata>
export const BuyShareMetadata = Type.Object({
    price: Type.Integer({ minimum: 0 })
})

export type BuyShare = Type.Static<typeof BuyShare>
export const BuyShare = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type', 'playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuyShare),
            playerId: Type.String(),
            railroadId: RailroadIdSchema,
            metadata: Type.Optional(BuyShareMetadata)
        })
    ])
)

export const BuyShareValidator = Compile(BuyShare)

export function isBuyShare(action?: GameAction): action is BuyShare {
    return action?.type === ActionType.BuyShare
}

// R-3.1, R-2.2: one of the turn's two trades; no price moves (R-3.2).
export class HydratedBuyShare extends HydratableAction<typeof BuyShare> implements BuyShare {
    declare type: ActionType.BuyShare
    declare playerId: string
    declare railroadId: RailroadId
    declare metadata?: BuyShareMetadata

    constructor(data: BuyShare) {
        super(data, BuyShareValidator)
    }

    apply(state: HydratedPromontoryPointGameState, _context?: MachineContext) {
        const refusal = buyShareRefusal(state, this.playerId, this.railroadId)
        if (refusal !== undefined) {
            throw new Error(`BuyShare refused: ${refusal}`)
        }
        const price = sharePrice(state, this.railroadId)
        const player = state.getPlayerState(this.playerId)
        player.money -= price
        player.shares[this.railroadId] += 1
        state.requireTurn().tradesUsed += 1
        this.metadata = { price }
    }
}
