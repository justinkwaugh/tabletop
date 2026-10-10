import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, assert, assertExists } from '@tabletop/common'
import { STARTING_MORALE } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'

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

/** A bid comes off the starting morale of the army chosen, which must be left with at least one point (rule 17). */
export const MAX_BID = Math.max(...Object.values(STARTING_MORALE)) - 1

export class HydratedPlaceBid extends HydratableAction<typeof PlaceBid> implements PlaceBid {
    declare type: ActionType.PlaceBid
    declare playerId: string
    declare amount: number

    constructor(data: PlaceBid) {
        super(data, PlaceBidValidator)
    }

    apply(state: HydratedNapoleonsTriumphGameState) {
        const auction = state.auction
        assertExists(auction, 'There is no morale auction')
        assert(
            this.amount <= MAX_BID &&
                (auction.highBid === undefined || this.amount > auction.highBid),
            'A bid must beat the previous bid'
        )
        auction.highBid = this.amount
        auction.highBidderId = this.playerId
    }
}
