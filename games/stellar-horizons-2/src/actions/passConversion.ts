import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { dropUnusableConversions } from '../model/economy.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type PassConversion = Type.Static<typeof PassConversion>
export const PassConversion = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PassConversion),
            playerId: Type.String()
        })
    ])
)

export const PassConversionValidator = Compile(PassConversion)

export function isPassConversion(action?: GameAction): action is PassConversion {
    return action?.type === ActionType.PassConversion
}

export class HydratedPassConversion
    extends HydratableAction<typeof PassConversion>
    implements PassConversion
{
    declare type: ActionType.PassConversion
    declare playerId: string

    constructor(data: PassConversion) {
        super(data, PassConversionValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (state.conversions.at(0)?.playerId !== this.playerId) {
            throw Error('Invalid PassConversion action')
        }
        state.conversions = state.conversions.slice(1)
        dropUnusableConversions(state)
    }
}
