import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { CardIdSchema } from '../components/cards.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

export type TakenTalonHalf = Type.Static<typeof TakenTalonHalf>
export const TakenTalonHalf = Type.Object({ cardIds: Type.Array(CardIdSchema) })

// Declarer takes one exposed half; the other goes to the opponents.
export type ChooseTalonHalf = Type.Static<typeof ChooseTalonHalf>
export const ChooseTalonHalf = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseTalonHalf),
            playerId: Type.String(),
            half: Type.Integer({ minimum: 0, maximum: 1 }),
            metadata: Type.Optional(TakenTalonHalf)
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
    declare half: number
    declare metadata?: TakenTalonHalf

    constructor(data: ChooseTalonHalf) {
        super(data, ChooseTalonHalfValidator)
    }

    apply(state: HydratedKoenigrufenGameState) {
        this.metadata = { cardIds: state.chooseTalonHalf(this.playerId, this.half) }
    }
}
