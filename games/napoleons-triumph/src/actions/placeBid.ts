import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { NapoleonsTriumphAction } from './gameAction.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'
import { placeMoraleBid } from '../model/moraleAuction.js'

export type PlaceBid = Type.Static<typeof PlaceBid>
export const PlaceBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceBid),
            playerId: Type.String(),
            amount: Type.Integer({ minimum: 0 })
        })
    ])
)

export const PlaceBidValidator = Compile(PlaceBid)

export function isPlaceBid(action?: GameAction): action is PlaceBid {
    return action?.type === ActionType.PlaceBid
}

export class HydratedPlaceBid extends NapoleonsTriumphAction<typeof PlaceBid> implements PlaceBid {
    declare type: ActionType.PlaceBid
    declare playerId: string
    declare amount: number

    constructor(data: PlaceBid) {
        super(data, PlaceBidValidator)
    }

    protected perform(state: HydratedNapoleonsTriumphGameState) {
        assertExists(state.auction, 'There is no morale auction')
        placeMoraleBid(state.auction, this.playerId, this.amount)
    }
}
