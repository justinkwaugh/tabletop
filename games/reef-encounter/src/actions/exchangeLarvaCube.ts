import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { CoralColor } from '../components/colors.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'

export type LarvaCubeExchange = Type.Static<typeof LarvaCubeExchange>
export const LarvaCubeExchange = Type.Object({ searchesBag: Type.Boolean() })

// Action 8: a larva cube becomes a polyp of its colour in the supply.
export type ExchangeLarvaCube = Type.Static<typeof ExchangeLarvaCube>
export const ExchangeLarvaCube = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ExchangeLarvaCube),
            playerId: Type.String(),
            color: Type.Enum(CoralColor),
            metadata: Type.Optional(LarvaCubeExchange)
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
    declare metadata?: LarvaCubeExchange

    constructor(data: ExchangeLarvaCube) {
        super(data, ExchangeLarvaCubeValidator)
    }

    apply(state: HydratedReefEncounterGameState) {
        this.metadata = state.exchangeLarvaCube(this.playerId, this.color)
    }
}
