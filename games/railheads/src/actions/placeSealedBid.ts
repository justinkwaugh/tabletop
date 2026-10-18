import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Visibility } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'
import { isValidSealedBid, placeSealedBid } from '../model/industryAuctionRules.js'

export type PlaceSealedBid = Type.Static<typeof PlaceSealedBid>
export const PlaceSealedBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceSealedBid),
            playerId: Type.String(),
            amount: Visibility.protect(Type.Number(), { policy: Visibility.Policy.Actor })
        })
    ])
)

export const PlaceSealedBidValidator = Compile(PlaceSealedBid)

export function isPlaceSealedBid(action?: GameAction): action is PlaceSealedBid {
    return action?.type === ActionType.PlaceSealedBid
}

export class HydratedPlaceSealedBid
    extends HydratableAction<typeof PlaceSealedBid>
    implements PlaceSealedBid
{
    declare type: ActionType.PlaceSealedBid
    declare playerId: string
    declare amount: number

    constructor(data: PlaceSealedBid) {
        super(data, PlaceSealedBidValidator)
    }

    apply(state: HydratedRailheadsGameState, _context?: MachineContext) {
        placeSealedBid(state, this.playerId, this.amount)
    }

    static isValid(state: HydratedRailheadsGameState, playerId: string, amount: number): boolean {
        return isValidSealedBid(state, playerId, amount)
    }

    static canBid(state: HydratedRailheadsGameState, playerId: string): boolean {
        return state.industryAuction?.bidders.includes(playerId) ?? false
    }
}
