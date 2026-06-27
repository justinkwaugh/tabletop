import * as Type from 'typebox'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedSantiagoGameState } from '../model/gameState.js'

export type PlaceBid = Type.Static<typeof PlaceBid>
export const PlaceBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceBid),
            amount: Type.Number({ minimum: 0 }),
            simultaneousGroupId: Type.Optional(Type.String())
        })
    ])
)

export const PlaceBidValidator = Compile(PlaceBid)

export function isPlaceBid(action: GameAction): action is PlaceBid {
    return action.type === ActionType.PlaceBid
}

export class HydratedPlaceBid extends HydratableAction<typeof PlaceBid> implements PlaceBid {
    declare type: ActionType.PlaceBid
    declare amount: number
    declare simultaneousGroupId?: string

    constructor(data: PlaceBid) {
        super(data, PlaceBidValidator)
    }

    apply(_state: HydratedSantiagoGameState) {
        // Bid is recorded in the state handler's onAction() after validation;
        // the action's apply() here is a no-op so the engine still calls it.
    }
}
