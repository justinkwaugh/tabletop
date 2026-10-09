import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'

// A player may let their final turn go by without eating.
export type PassFinalTurn = Type.Static<typeof PassFinalTurn>
export const PassFinalTurn = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PassFinalTurn),
            playerId: Type.String()
        })
    ])
)

export const PassFinalTurnValidator = Compile(PassFinalTurn)

export function isPassFinalTurn(action?: GameAction): action is PassFinalTurn {
    return action?.type === ActionType.PassFinalTurn
}

export class HydratedPassFinalTurn
    extends HydratableAction<typeof PassFinalTurn>
    implements PassFinalTurn
{
    declare type: ActionType.PassFinalTurn
    declare playerId: string

    constructor(data: PassFinalTurn) {
        super(data, PassFinalTurnValidator)
    }

    apply() {}
}
