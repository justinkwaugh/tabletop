import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'

export type PassBid = Type.Static<typeof PassBid>
export const PassBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PassBid),
            playerId: Type.String()
        })
    ])
)

export const PassBidValidator = Compile(PassBid)

export function isPassBid(action?: GameAction): action is PassBid {
    return action?.type === ActionType.PassBid
}

export class HydratedPassBid extends HydratableAction<typeof PassBid> implements PassBid {
    declare type: ActionType.PassBid
    declare playerId: string

    constructor(data: PassBid) {
        super(data, PassBidValidator)
    }

    apply(state: HydratedNapoleonsTriumphGameState) {
        const auction = state.auction
        assertExists(auction, 'There is no morale auction')
        auction.highBid = auction.highBid ?? 0
        auction.highBidderId = state.players.find(
            (player) => player.playerId !== this.playerId
        )?.playerId
    }
}
