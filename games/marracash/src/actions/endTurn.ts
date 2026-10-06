import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'

export type EndTurn = Type.Static<typeof EndTurn>
export const EndTurn = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.EndTurn)
        })
    ])
)

export const EndTurnValidator = Compile(EndTurn)

export function isEndTurn(action?: GameAction): action is EndTurn {
    return action?.type === ActionType.EndTurn
}

export class HydratedEndTurn extends HydratableAction<typeof EndTurn> implements EndTurn {
    declare type: ActionType.EndTurn

    constructor(data: EndTurn) {
        super(data, EndTurnValidator)
    }

    apply() {}
}
