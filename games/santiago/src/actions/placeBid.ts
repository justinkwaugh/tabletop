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
            simultaneousGroupId: Type.Optional(Type.String()),
            // Always optional, because it is an output: the server sets it only on the
            // round's last bid, once bids resolve and the new canal overseer is known.
            // Used purely for history description, not gameplay. Never read from input.
            metadata: Type.Optional(Type.Object({ overseerId: Type.String() }))
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
    declare metadata?: { overseerId: string }

    constructor(data: PlaceBid) {
        super(data, PlaceBidValidator)
    }

    apply(_state: HydratedSantiagoGameState) {
        // Bid is recorded in the state handler's onAction() after validation;
        // the action's apply() here does not touch bid state.

        // metadata is an output, never an input: discard anything the client submitted so
        // a forged overseerId can't reach history. The engine calls apply() before
        // onAction(), which reassigns it authoritatively on the round's last bid.
        delete this.metadata
    }
}
