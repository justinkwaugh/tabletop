import { Type, type Static } from '@sinclair/typebox'
import { AuctionParticipant, GameAction, HydratableAction } from '@tabletop/common'

import { HydratedFreshFishGameState } from '../model/gameState.js'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { ActionType } from '../definition/actions.js'

export type EndAuction = Static<typeof EndAuction>
export const EndAuction = Type.Composite([
    GameAction,
    Type.Object({
        type: Type.Literal(ActionType.EndAuction),
        winnerId: Type.String(),
        highBid: Type.Number(),
        metadata: Type.Optional(Type.Object({ participants: Type.Array(AuctionParticipant) }))
    })
])

export const EndAuctionValidator = TypeCompiler.Compile(EndAuction)

export function isEndAuction(action: GameAction): action is EndAuction {
    return action.type === ActionType.EndAuction
}
export class HydratedEndAuction extends HydratableAction<typeof EndAuction> implements EndAuction {
    declare type: ActionType.EndAuction
    declare winnerId: string
    declare highBid: number
    declare metadata?: { participants: AuctionParticipant[] }

    constructor(data: EndAuction) {
        super(data, EndAuctionValidator)
    }

    apply(state: HydratedFreshFishGameState) {
        const currentAuction = state.currentAuction
        if (!currentAuction) {
            throw Error('Cannot end auction without a currentAuction')
        }

        const winningPlayer = state.getPlayerState(this.winnerId)
        winningPlayer.money -= this.highBid

        this.metadata = { participants: currentAuction.participants }
    }
}
