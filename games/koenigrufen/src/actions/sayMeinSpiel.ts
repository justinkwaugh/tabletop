import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

// Forehand reserves the game, to name a contract if nobody bids.
export type SayMeinSpiel = Type.Static<typeof SayMeinSpiel>
export const SayMeinSpiel = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SayMeinSpiel),
            playerId: Type.String()
        })
    ])
)

export const SayMeinSpielValidator = Compile(SayMeinSpiel)

export function isSayMeinSpiel(action?: GameAction): action is SayMeinSpiel {
    return action?.type === ActionType.SayMeinSpiel
}

export class HydratedSayMeinSpiel
    extends HydratableAction<typeof SayMeinSpiel>
    implements SayMeinSpiel
{
    declare type: ActionType.SayMeinSpiel
    declare playerId: string

    constructor(data: SayMeinSpiel) {
        super(data, SayMeinSpielValidator)
    }

    apply(state: HydratedKoenigrufenGameState) {
        state.sayMeinSpiel(this.playerId)
    }
}
