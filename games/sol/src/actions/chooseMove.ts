import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { ActionCategory } from '../definition/actionCategories.js'

export type ChooseMoveMetadata = Type.Static<typeof ChooseMoveMetadata>
export const ChooseMoveMetadata = Type.Object({})

export type ChooseMove = Type.Static<typeof ChooseMove>
export const ChooseMove = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseMove),
            playerId: Type.String(),
            metadata: Type.Optional(ChooseMoveMetadata)
        })
    ])
)

export const ChooseMoveValidator = Compile(ChooseMove)

export function isChooseMove(action?: GameAction): action is ChooseMove {
    return action?.type === ActionType.ChooseMove
}

export class HydratedChooseMove extends HydratableAction<typeof ChooseMove> implements ChooseMove {
    declare type: ActionType.ChooseMove
    declare playerId: string
    declare actionCategory: ActionCategory
    declare metadata?: ChooseMoveMetadata

    constructor(data: ChooseMove) {
        super(data, ChooseMoveValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        // This action does not directly modify the game state
        // though it could
    }
}
