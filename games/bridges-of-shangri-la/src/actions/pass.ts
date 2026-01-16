import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { HydratedBridgesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type Pass = Type.Static<typeof Pass>
export const Pass = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Pass),
            playerId: Type.String(),
            metadata: Type.Optional(
                Type.Object({
                    recruiting: Type.Boolean()
                })
            )
        })
    ])
)

export const PassValidator = Compile(Pass)

export function isPass(action?: GameAction): action is Pass {
    return action?.type === ActionType.Pass
}

export class HydratedPass extends HydratableAction<typeof Pass> implements Pass {
    declare type: ActionType.Pass
    declare playerId: string
    declare metadata?: { recruiting: boolean }

    constructor(data: Pass) {
        super(data, PassValidator)
    }

    apply(_state: HydratedBridgesGameState) {
        // Pass does not modify the game state directly
    }
}
