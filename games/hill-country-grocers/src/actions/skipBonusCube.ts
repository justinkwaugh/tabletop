import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedHcgGameState } from '../model/gameState.js'

export type SkipBonusCube = Type.Static<typeof SkipBonusCube>
export const SkipBonusCube = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SkipBonusCube),
            playerId: Type.String()
        })
    ])
)

export const SkipBonusCubeValidator = Compile(SkipBonusCube)

export function isSkipBonusCube(action?: GameAction): action is SkipBonusCube {
    return action?.type === ActionType.SkipBonusCube
}

export class HydratedSkipBonusCube
    extends HydratableAction<typeof SkipBonusCube>
    implements SkipBonusCube
{
    declare type: ActionType.SkipBonusCube
    declare playerId: string

    constructor(data: SkipBonusCube) {
        super(data, SkipBonusCubeValidator)
    }

    apply(state: HydratedHcgGameState, _context?: MachineContext) {
        assert(HydratedSkipBonusCube.canSkip(state, this.playerId), 'No bonus cube to skip')
    }

    static canSkip(state: HydratedHcgGameState, playerId: string): boolean {
        return state.bonusCube?.playerId === playerId
    }
}
