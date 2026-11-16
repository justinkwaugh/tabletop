import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedDvonnGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { isSpace } from '../model/geometry.js'
import { Piece, RemovedStack } from '../model/board.js'

export type MoveStackMetadata = Type.Static<typeof MoveStackMetadata>
// `passedPlayerId` names a player whose turn this move's end skipped, as they could not move.
export const MoveStackMetadata = Type.Object({
    moved: Type.Array(Piece),
    landedOn: Type.Array(Piece),
    removed: Type.Array(RemovedStack),
    passedPlayerId: Type.Optional(Type.String())
})

export type MoveStack = Type.Static<typeof MoveStack>
export const MoveStack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.MoveStack),
            playerId: Type.String(),
            from: AxialCoordinates,
            to: AxialCoordinates,
            metadata: Type.Optional(MoveStackMetadata)
        })
    ])
)

export const MoveStackValidator = Compile(MoveStack)

export function isMoveStack(action?: GameAction): action is MoveStack {
    return action?.type === ActionType.MoveStack
}

export class HydratedMoveStack extends HydratableAction<typeof MoveStack> implements MoveStack {
    declare type: ActionType.MoveStack
    declare playerId: string
    declare from: AxialCoordinates
    declare to: AxialCoordinates
    declare metadata?: MoveStackMetadata

    constructor(data: MoveStack) {
        super(data, MoveStackValidator)
    }

    apply(state: HydratedDvonnGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid MoveStack action')
        }
        this.metadata = state.moveStack(this.from, this.to)
    }

    isValid(state: HydratedDvonnGameState): boolean {
        return (
            isSpace(this.from) &&
            isSpace(this.to) &&
            state.canPlayerMove(this.playerId, this.from, this.to)
        )
    }
}
