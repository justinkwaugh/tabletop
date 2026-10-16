import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedGipfGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type FinishRemoving = Type.Static<typeof FinishRemoving>
export const FinishRemoving = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.FinishRemoving),
            playerId: Type.String()
        })
    ])
)

export const FinishRemovingValidator = Compile(FinishRemoving)

export function isFinishRemoving(action?: GameAction): action is FinishRemoving {
    return action?.type === ActionType.FinishRemoving
}

// Leaves rows of only GIPF-pieces standing; rows that must be taken cannot be left.
export class HydratedFinishRemoving
    extends HydratableAction<typeof FinishRemoving>
    implements FinishRemoving
{
    declare type: ActionType.FinishRemoving
    declare playerId: string

    constructor(data: FinishRemoving) {
        super(data, FinishRemovingValidator)
    }

    apply(state: HydratedGipfGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid FinishRemoving action')
        }
    }

    isValid(state: HydratedGipfGameState): boolean {
        return (
            state.resolvingPlayerIds[0] === this.playerId &&
            !state.board.rowsOf(this.playerId).some((row) => state.board.isMandatory(row))
        )
    }
}
