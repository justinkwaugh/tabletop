import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { NapoleonsTriumphAction } from './gameAction.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'
import { passMoraleBid } from '../model/moraleAuction.js'

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

export class HydratedPassBid extends NapoleonsTriumphAction<typeof PassBid> implements PassBid {
    declare type: ActionType.PassBid
    declare playerId: string

    constructor(data: PassBid) {
        super(data, PassBidValidator)
    }

    protected perform(state: HydratedNapoleonsTriumphGameState) {
        assertExists(state.auction, 'There is no morale auction')
        passMoraleBid(state.auction, this.playerId)
    }
}
