import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedHexGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { swapRuleFromConfig } from '../definition/config.js'

export type SwapColors = Type.Static<typeof SwapColors>
export const SwapColors = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SwapColors),
            playerId: Type.String()
        })
    ])
)

export const SwapColorsValidator = Compile(SwapColors)

export function isSwapColors(action?: GameAction): action is SwapColors {
    return action?.type === ActionType.SwapColors
}

export class HydratedSwapColors extends HydratableAction<typeof SwapColors> implements SwapColors {
    declare type: ActionType.SwapColors
    declare playerId: string

    constructor(data: SwapColors) {
        super(data, SwapColorsValidator)
    }

    apply(state: HydratedHexGameState, context?: MachineContext) {
        if (!context || !swapRuleFromConfig(context.gameConfig) || !state.swapIsOpen()) {
            throw Error('Invalid SwapColors action')
        }
        state.swapColors()
    }
}
