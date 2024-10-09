import { Type, type Static } from '@sinclair/typebox'
import { GameAction, HydratableAction } from '@tabletop/common'

import { HydratedEstatesGameState } from '../model/gameState.js'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { ActionType } from '../definition/actions.js'

export type Embezzle = Static<typeof Embezzle>
export const Embezzle = Type.Composite([
    Type.Omit(GameAction, ['playerId', 'type']),
    Type.Object({
        type: Type.Literal(ActionType.Embezzle),
        playerId: Type.String()
    })
])

export const EmbezzleValidator = TypeCompiler.Compile(Embezzle)

export function isEmbezzle(action: GameAction): action is Embezzle {
    return action.type === ActionType.Embezzle
}

export class HydratedEmbezzle extends HydratableAction<typeof Embezzle> implements Embezzle {
    declare type: ActionType.Embezzle
    declare playerId: string

    constructor(data: Embezzle) {
        super(data, EmbezzleValidator)
    }

    apply(state: HydratedEstatesGameState) {
        const playerState = state.getPlayerState(this.playerId)
        if (!HydratedEmbezzle.canEmbezzle(this.playerId, state)) {
            throw Error(`Player ${this.playerId} does not have the money to embezzle`)
        }
        playerState.money--
        playerState.stolen++
        state.embezzled = true
    }

    static canEmbezzle(playerId: string, state: HydratedEstatesGameState): boolean {
        return !state.embezzled && state.getPlayerState(playerId).money > 0
    }
}
