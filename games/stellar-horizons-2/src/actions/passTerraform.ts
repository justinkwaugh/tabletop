import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type PassTerraform = Type.Static<typeof PassTerraform>
export const PassTerraform = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PassTerraform),
            playerId: Type.String()
        })
    ])
)

export const PassTerraformValidator = Compile(PassTerraform)

export function isPassTerraform(action?: GameAction): action is PassTerraform {
    return action?.type === ActionType.PassTerraform
}

export class HydratedPassTerraform
    extends HydratableAction<typeof PassTerraform>
    implements PassTerraform
{
    declare type: ActionType.PassTerraform
    declare playerId: string

    constructor(data: PassTerraform) {
        super(data, PassTerraformValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (state.terraformQueue[0] !== this.playerId) {
            throw Error('Invalid PassTerraform action')
        }
    }
}
