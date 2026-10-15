import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, OffsetCoordinates } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { ReefBoardIdSchema, type ReefBoardId } from '../components/reefBoards.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'
import { CoralEaten } from '../model/reef.js'

// Action 1: the parrotfish eats a coral its owner's shrimp guards, named by any of its squares.
export type EatCoral = Type.Static<typeof EatCoral>
export const EatCoral = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.EatCoral),
            playerId: Type.String(),
            boardId: ReefBoardIdSchema,
            coords: OffsetCoordinates,
            metadata: Type.Optional(CoralEaten)
        })
    ])
)

export const EatCoralValidator = Compile(EatCoral)

export function isEatCoral(action?: GameAction): action is EatCoral {
    return action?.type === ActionType.EatCoral
}

export class HydratedEatCoral extends HydratableAction<typeof EatCoral> implements EatCoral {
    declare type: ActionType.EatCoral
    declare playerId: string
    declare boardId: ReefBoardId
    declare coords: OffsetCoordinates
    declare metadata?: CoralEaten

    constructor(data: EatCoral) {
        super(data, EatCoralValidator)
    }

    apply(state: HydratedReefEncounterGameState) {
        this.metadata = state.eatCoral(this.playerId, {
            boardId: this.boardId,
            coords: this.coords
        })
    }
}
