import { Type, type Static } from 'typebox'
import { GameAction, HydratableAction } from '@tabletop/common'
import { HydratedFreshFishGameState } from '../model/gameState.js'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'

export type Pass = Static<typeof Pass>
export const Pass = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.Pass)
        })
    ])
)

export const PassValidator = Compile(Pass)

export function isPass(action: GameAction): action is Pass {
    return action.type === ActionType.Pass
}

export class HydratedPass extends HydratableAction<typeof Pass> implements Pass {
    declare type: ActionType.Pass

    constructor(data: Pass) {
        super(data, PassValidator)
    }

    apply(_state: HydratedFreshFishGameState) {
        // Pass does not modify the game state directly
    }
}
