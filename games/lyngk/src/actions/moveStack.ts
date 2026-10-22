import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLyngkGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Stack } from '../model/pieces.js'

export type MoveStackMetadata = Type.Static<typeof MoveStackMetadata>
export const MoveStackMetadata = Type.Object({
    moved: Stack,
    landedOn: Stack,
    scored: Type.Boolean(),
    completedSix: Type.Boolean()
})

export type MoveStack = Type.Static<typeof MoveStack>
export const MoveStack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.MoveStack),
            playerId: Type.String(),
            from: AxialCoordinates,
            via: Type.Array(AxialCoordinates),
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
    declare via: AxialCoordinates[]
    declare to: AxialCoordinates
    declare metadata?: MoveStackMetadata

    constructor(data: MoveStack) {
        super(data, MoveStackValidator)
    }

    apply(state: HydratedLyngkGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid MoveStack action')
        }
        this.metadata = structuredClone(state.move(this.playerId, this))
    }

    isValid(state: HydratedLyngkGameState): boolean {
        return (
            state.board.findPath(this, state.rightsOf(this.playerId), state.rules.maxHeight) !==
            undefined
        )
    }
}
