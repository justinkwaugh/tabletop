import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { CoralColor } from '../components/colors.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'

// Action 8: a larva cube becomes a polyp of its colour behind the screen.
export type ExchangeLarvaCube = Type.Static<typeof ExchangeLarvaCube>
export const ExchangeLarvaCube = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ExchangeLarvaCube),
            playerId: Type.String(),
            color: Type.Enum(CoralColor)
        })
    ])
)

export const ExchangeLarvaCubeValidator = Compile(ExchangeLarvaCube)

export function isExchangeLarvaCube(action?: GameAction): action is ExchangeLarvaCube {
    return action?.type === ActionType.ExchangeLarvaCube
}

export class HydratedExchangeLarvaCube
    extends HydratableAction<typeof ExchangeLarvaCube>
    implements ExchangeLarvaCube
{
    declare type: ActionType.ExchangeLarvaCube
    declare playerId: string
    declare color: CoralColor

    constructor(data: ExchangeLarvaCube) {
        super(data, ExchangeLarvaCubeValidator)
    }

    apply(state: HydratedReefEncounterGameState) {
        state.exchangeLarvaCube(this.playerId, this.color)
    }
}
