import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedGipfPotentialsGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

// The rows of GIPF-pieces alone left standing, each by its ends.
export type FinishRemovingMetadata = Type.Static<typeof FinishRemovingMetadata>
export const FinishRemovingMetadata = Type.Object({
    left: Type.Array(Type.Object({ from: AxialCoordinates, to: AxialCoordinates }))
})

export type FinishRemoving = Type.Static<typeof FinishRemoving>
export const FinishRemoving = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.FinishRemoving),
            playerId: Type.String(),
            metadata: Type.Optional(FinishRemovingMetadata)
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
    declare metadata?: FinishRemovingMetadata

    constructor(data: FinishRemoving) {
        super(data, FinishRemovingValidator)
    }

    apply(state: HydratedGipfPotentialsGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid FinishRemoving action')
        }
        const left = state.board.rowsOf(this.playerId).map(({ from, to }) => ({ from, to }))
        this.metadata = { left: structuredClone(left) }
    }

    isValid(state: HydratedGipfPotentialsGameState): boolean {
        const { board } = state
        return (
            state.resolvingPlayerIds[0] === this.playerId &&
            !board.rowsOf(this.playerId).some((row) => board.isMandatory(row))
        )
    }
}
