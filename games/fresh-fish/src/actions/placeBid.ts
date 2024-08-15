import { Type, type Static } from '@sinclair/typebox'
import { GameAction, HydratableAction } from '@tabletop/common'
import { HydratedFreshFishGameState } from '../model/gameState.js'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { ActionType } from '../definition/actions.js'

export type PlaceBid = Static<typeof PlaceBid>
export const PlaceBid = Type.Composite([
    Type.Omit(GameAction, ['playerId']),
    Type.Object({
        type: Type.Literal(ActionType.PlaceBid),
        playerId: Type.String(),
        amount: Type.Number()
    })
])

export const PlaceBidValidator = TypeCompiler.Compile(PlaceBid)

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
