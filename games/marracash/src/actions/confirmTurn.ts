import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'

export type ConfirmTurn = Type.Static<typeof ConfirmTurn>
export const ConfirmTurn = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ConfirmTurn),
            playerId: Type.String()
        })
    ])
)

export const ConfirmTurnValidator = Compile(ConfirmTurn)

export function isConfirmTurn(action?: GameAction): action is ConfirmTurn {
    return action?.type === ActionType.ConfirmTurn
}

export class HydratedConfirmTurn
    extends HydratableAction<typeof ConfirmTurn>
    implements ConfirmTurn
{
    declare type: ActionType.ConfirmTurn
    declare playerId: string

    constructor(data: ConfirmTurn) {
        super(data, ConfirmTurnValidator)
    }

    apply() {}
}
