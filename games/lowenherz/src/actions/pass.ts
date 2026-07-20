import * as Type from 'typebox'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedLowenherzGameState } from '../model/gameState.js'

export type Pass = Type.Static<typeof Pass>
export const Pass = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.Pass)
        })
    ])
)

export const PassValidator = Compile(Pass)

export function isPass(action?: GameAction): action is Pass {
    return action?.type === ActionType.Pass
}

// Shared across PlacingWalls/PlacingKnights - lets the winner of a border or knight
// action voluntarily stop early instead of being forced to place their full
// allotment. Rulebook phrasing is "may place as many... as shown" / "may either place
// a knight... or extend a region" (never "must") - stopping early is expected, not
// just a byproduct of running out of walls/knights/money. No state change of its own;
// each state handler's onAction drives the transition back to ResolvingActions.
export class HydratedPass extends HydratableAction<typeof Pass> implements Pass {
    declare type: ActionType.Pass

    constructor(data: Pass) {
        super(data, PassValidator)
    }

    apply(_state: HydratedLowenherzGameState) {
        // No state change - the state handler drives the transition
    }
}
