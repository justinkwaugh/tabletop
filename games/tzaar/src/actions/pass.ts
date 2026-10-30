import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedTzaarGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { stuckPlayerAfterTurnOf } from '../stateHandlers/turnFlow.js'

export type PassMetadata = Type.Static<typeof PassMetadata>
export const PassMetadata = Type.Object({
    stuckPlayerId: Type.Optional(Type.String())
})

export type Pass = Type.Static<typeof Pass>
export const Pass = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Pass),
            playerId: Type.String(),
            metadata: Type.Optional(PassMetadata)
        })
    ])
)

export const PassValidator = Compile(Pass)

export function isPass(action?: GameAction): action is Pass {
    return action?.type === ActionType.Pass
}

// Rule E c: the second move of a turn may be skipped.
export class HydratedPass extends HydratableAction<typeof Pass> implements Pass {
    declare type: ActionType.Pass
    declare playerId: string
    declare metadata?: PassMetadata

    constructor(data: Pass) {
        super(data, PassValidator)
    }

    apply(state: HydratedTzaarGameState, _context?: MachineContext) {
        const stuckPlayerId = stuckPlayerAfterTurnOf(state, this.playerId)
        this.metadata = stuckPlayerId === undefined ? {} : { stuckPlayerId }
    }
}
