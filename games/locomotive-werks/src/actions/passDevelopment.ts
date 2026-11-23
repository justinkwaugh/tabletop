import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedLwGameState } from '../model/gameState.js'

export type PassDevelopment = Type.Static<typeof PassDevelopment>
export const PassDevelopment = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PassDevelopment),
            playerId: Type.String()
        })
    ])
)

export const PassDevelopmentValidator = Compile(PassDevelopment)

export function isPassDevelopment(action?: GameAction): action is PassDevelopment {
    return action?.type === ActionType.PassDevelopment
}

export class HydratedPassDevelopment
    extends HydratableAction<typeof PassDevelopment>
    implements PassDevelopment
{
    declare type: ActionType.PassDevelopment
    declare playerId: string

    constructor(data: PassDevelopment) {
        super(data, PassDevelopmentValidator)
    }

    apply(_state: HydratedLwGameState, _context?: MachineContext) {}
}
