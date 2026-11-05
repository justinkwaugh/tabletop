import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedGipfPotentialsGameState } from '../model/gameState.js'
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

// Leaves rows of GIPF-pieces alone standing; rows that must be taken cannot be left.
export class HydratedFinishRemoving
    extends HydratableAction<typeof FinishRemoving>
    implements FinishRemoving
{
    declare type: ActionType.FinishRemoving
    declare playerId: string

    constructor(data: FinishRemoving) {
        super(data, FinishRemovingValidator)
    }

    apply(state: HydratedGipfPotentialsGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid FinishRemoving action')
        }
    }

    isValid(state: HydratedGipfPotentialsGameState): boolean {
        const { board } = state
        return (
            state.resolvingPlayerIds[0] === this.playerId &&
            !board.rowsOf(this.playerId).some((row) => board.isMandatory(row))
        )
    }
}
