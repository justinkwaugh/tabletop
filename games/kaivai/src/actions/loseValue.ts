import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiGameState } from '../model/gameState.js'

export type LoseValue = Static<typeof LoseValue>
export const LoseValue = Type.Composite([
    Type.Omit(GameAction, ['playerId']),
    Type.Object({
        type: Type.Literal(ActionType.LoseValue)
    })
])

export const LoseValueValidator = TypeCompiler.Compile(LoseValue)

export function isLoseValue(action?: GameAction): action is LoseValue {
    return action?.type === ActionType.LoseValue
}

export class HydratedLoseValue extends HydratableAction<typeof LoseValue> implements LoseValue {
    declare type: ActionType.LoseValue

    constructor(data: LoseValue) {
        super(data, LoseValueValidator)
    }

    apply(state: HydratedKaivaiGameState) {
        for (const player of state.players) {
            player.loseFishValue()
            player.loseShellValue()
        }

        state.influence = {}
    }
}
