import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedTzaarGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { isSpace } from '../model/geometry.js'
import { Piece } from '../model/board.js'
import { stuckPlayerAfterTurnOf } from '../stateHandlers/turnFlow.js'

export type StackMetadata = Type.Static<typeof StackMetadata>
export const StackMetadata = Type.Object({
    moved: Type.Array(Piece),
    landedOn: Type.Array(Piece),
    stuckPlayerId: Type.Optional(Type.String())
})

export type Stack = Type.Static<typeof Stack>
export const Stack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Stack),
            playerId: Type.String(),
            from: AxialCoordinates,
            to: AxialCoordinates,
            metadata: Type.Optional(StackMetadata)
        })
    ])
)

export const StackValidator = Compile(Stack)

export function isStack(action?: GameAction): action is Stack {
    return action?.type === ActionType.Stack
}

export class HydratedStack extends HydratableAction<typeof Stack> implements Stack {
    declare type: ActionType.Stack
    declare playerId: string
    declare from: AxialCoordinates
    declare to: AxialCoordinates
    declare metadata?: StackMetadata

    constructor(data: Stack) {
        super(data, StackValidator)
    }

    apply(state: HydratedTzaarGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid Stack action')
        }
        const metadata: StackMetadata = state.stack(this.from, this.to)
        const stuckPlayerId = stuckPlayerAfterTurnOf(state, this.playerId)
        if (stuckPlayerId !== undefined) {
            metadata.stuckPlayerId = stuckPlayerId
        }
        this.metadata = metadata
    }

    isValid(state: HydratedTzaarGameState): boolean {
        return (
            isSpace(this.from) &&
            isSpace(this.to) &&
            state.canPlayerStack(this.playerId, this.from, this.to)
        )
    }
}
