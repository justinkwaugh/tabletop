import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiGameState } from '../model/gameState.js'

export type Sacrifice = Static<typeof Sacrifice>
export const Sacrifice = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Sacrifice),
            playerId: Type.String()
        })
    ])
)

export const SacrificeValidator = Compile(Sacrifice)

export function isSacrifice(action?: GameAction): action is Sacrifice {
    return action?.type === ActionType.Sacrifice
}

export class HydratedSacrifice extends HydratableAction<typeof Sacrifice> implements Sacrifice {
    declare type: ActionType.Sacrifice
    declare playerId: string

    constructor(data: Sacrifice) {
        super(data, SacrificeValidator)
    }

    apply(state: HydratedKaivaiGameState) {
        const playerState = state.getPlayerState(this.playerId)
        playerState.influence += 2
    }
}
