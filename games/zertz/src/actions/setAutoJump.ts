import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, assert, GameAction, HydratableAction } from '@tabletop/common'
import { HydratedZertzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

// A standing declaration (ADR 0007) either player may make at any time: while it is on, a jump
// with only one choice is made for them at once. A new one replaces their last (ADR 0008).
export type SetAutoJump = Type.Static<typeof SetAutoJump>
export const SetAutoJump = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId', 'outOfTurn']),
        Type.Object({
            type: Type.Literal(ActionType.SetAutoJump),
            playerId: Type.String(),
            outOfTurn: Type.Literal(true),
            supersedable: Type.Literal(true),
            on: Type.Boolean()
        })
    ])
)

export const SetAutoJumpValidator = Compile(SetAutoJump)

export function isSetAutoJump(action?: GameAction): action is SetAutoJump {
    return action?.type === ActionType.SetAutoJump
}

export function autoJumpProblem(
    state: HydratedZertzGameState,
    request: Pick<SetAutoJump, 'playerId' | 'on' | 'supersedesActionId'>
): string | undefined {
    if (state.autoJumpForAll === true) return 'Auto-jump is on for both players'
    if (!state.players.some((player) => player.playerId === request.playerId))
        return 'Only a seated player can auto-jump'
    // A replacement is checked where the declaration it replaces is gone, so it may repeat what
    // stands there.
    if (
        request.supersedesActionId === undefined &&
        state.autoJumps(request.playerId) === request.on
    )
        return request.on ? 'Auto-jump is already on' : 'Auto-jump is already off'
    return undefined
}

export class HydratedSetAutoJump
    extends HydratableAction<typeof SetAutoJump>
    implements SetAutoJump
{
    declare type: ActionType.SetAutoJump
    declare playerId: string
    declare outOfTurn: true
    declare supersedable: true
    declare on: boolean

    constructor(data: SetAutoJump) {
        super(data, SetAutoJumpValidator)
    }

    apply(state: HydratedZertzGameState) {
        assert(this.source === ActionSource.User, 'Auto-jump is a player decision')
        const problem = autoJumpProblem(state, this)
        assert(!problem, problem)
        const player = state.getPlayerState(this.playerId)
        if (this.on) {
            player.autoJump = true
        } else {
            delete player.autoJump
        }
    }
}
