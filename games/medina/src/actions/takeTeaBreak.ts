import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedMedinaGameState } from '../model/gameState.js'

export type TakeTeaBreak = Type.Static<typeof TakeTeaBreak>
export const TakeTeaBreak = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.TakeTeaBreak),
            playerId: Type.String()
        })
    ])
)

export const TakeTeaBreakValidator = Compile(TakeTeaBreak)

export function isTakeTeaBreak(action?: GameAction): action is TakeTeaBreak {
    return action?.type === ActionType.TakeTeaBreak
}

export class HydratedTakeTeaBreak
    extends HydratableAction<typeof TakeTeaBreak>
    implements TakeTeaBreak
{
    declare type: ActionType.TakeTeaBreak
    declare playerId: string

    constructor(data: TakeTeaBreak) {
        super(data, TakeTeaBreakValidator)
    }

    apply(state: HydratedMedinaGameState, _context?: MachineContext) {
        if (!state.canTakeTeaBreak(this.playerId)) {
            throw Error('Invalid TakeTeaBreak action')
        }
        const player = state.getPlayerState(this.playerId)
        player.teaTiles -= 1
        player.tookTeaBreak = true
        state.activeTurn().placementsLeft -= 1
    }
}
