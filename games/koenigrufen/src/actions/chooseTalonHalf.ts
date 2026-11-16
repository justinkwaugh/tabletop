import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { CardIdSchema } from '../components/cards.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

// Declarer takes one exposed half, named by its cards; the other goes to the opponents.
export type ChooseTalonHalf = Type.Static<typeof ChooseTalonHalf>
export const ChooseTalonHalf = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseTalonHalf),
            playerId: Type.String(),
            cardIds: Type.Array(CardIdSchema)
        })
    ])
)

export const ChooseTalonHalfValidator = Compile(ChooseTalonHalf)

export function isChooseTalonHalf(action?: GameAction): action is ChooseTalonHalf {
    return action?.type === ActionType.ChooseTalonHalf
}

export class HydratedChooseTalonHalf
    extends HydratableAction<typeof ChooseTalonHalf>
    implements ChooseTalonHalf
{
    declare type: ActionType.ChooseTalonHalf
    declare playerId: string
    declare cardIds: string[]

    constructor(data: ChooseTalonHalf) {
        super(data, ChooseTalonHalfValidator)
    }

    apply(state: HydratedKoenigrufenGameState) {
        state.chooseTalonHalf(this.playerId, this.cardIds)
    }
}
