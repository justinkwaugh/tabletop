import * as Type from 'typebox'
import { GameAction, HydratableAction, Visibility } from '@tabletop/common'
import { HydratedFreshFishGameState } from '../model/gameState.js'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { FreshFishVisibilityPolicy } from '../definition/visibility.js'

export type PlaceBid = Type.Static<typeof PlaceBid>
export const PlaceBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceBid),
            playerId: Type.String(),
            amount: Visibility.protect(Type.Number(), {
                policy: FreshFishVisibilityPolicy.SealedBid
            })
        })
    ])
)

export type PlaceBidProjection = Type.Static<typeof PlaceBidProjection>
export const PlaceBidProjection = Visibility.createProjectionSchema(PlaceBid)

export const PlaceBidValidator = Compile(PlaceBid)

export function isPlaceBid(action: GameAction): action is PlaceBid {
    return action.type === ActionType.PlaceBid
}
export class HydratedPlaceBid extends HydratableAction<typeof PlaceBid> implements PlaceBid {
    declare type: ActionType.PlaceBid
    declare playerId: string
    declare amount: number

    constructor(data: PlaceBid) {
        super(data, PlaceBidValidator)
    }

    apply(state: HydratedFreshFishGameState) {
        if (!state.currentAuction) {
            throw Error('Cannot start auction without a chosen tile')
        }

        state.currentAuction.placeBid(this.playerId, this.amount)
    }
}
