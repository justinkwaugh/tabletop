import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

// With the called King in the talon, declarer concedes and pays the game to each opponent.
export type GiveUp = Type.Static<typeof GiveUp>
export const GiveUp = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.GiveUp),
            playerId: Type.String()
        })
    ])
)

export const GiveUpValidator = Compile(GiveUp)

export function isGiveUp(action?: GameAction): action is GiveUp {
    return action?.type === ActionType.GiveUp
}

export class HydratedGiveUp extends HydratableAction<typeof GiveUp> implements GiveUp {
    declare type: ActionType.GiveUp
    declare playerId: string

    constructor(data: GiveUp) {
        super(data, GiveUpValidator)
    }

    apply(state: HydratedKoenigrufenGameState) {
        state.giveUp(this.playerId)
    }
}
