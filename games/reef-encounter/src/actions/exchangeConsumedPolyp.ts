import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { CoralColor } from '../components/colors.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'

// Action 6: a consumed polyp becomes a larva cube of its colour, which must be played next.
export type ExchangeConsumedPolyp = Type.Static<typeof ExchangeConsumedPolyp>
export const ExchangeConsumedPolyp = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ExchangeConsumedPolyp),
            playerId: Type.String(),
            color: Type.Enum(CoralColor)
        })
    ])
)

export const ExchangeConsumedPolypValidator = Compile(ExchangeConsumedPolyp)

export function isExchangeConsumedPolyp(action?: GameAction): action is ExchangeConsumedPolyp {
    return action?.type === ActionType.ExchangeConsumedPolyp
}

export class HydratedExchangeConsumedPolyp
    extends HydratableAction<typeof ExchangeConsumedPolyp>
    implements ExchangeConsumedPolyp
{
    declare type: ActionType.ExchangeConsumedPolyp
    declare playerId: string
    declare color: CoralColor

    constructor(data: ExchangeConsumedPolyp) {
        super(data, ExchangeConsumedPolypValidator)
    }

    apply(state: HydratedReefEncounterGameState) {
        state.exchangeConsumedPolyp(this.playerId, this.color)
    }
}
