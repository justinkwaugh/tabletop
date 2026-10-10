import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'

export type EndTurn = Type.Static<typeof EndTurn>
export const EndTurn = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.EndTurn),
            playerId: Type.String()
        })
    ])
)

export const EndTurnValidator = Compile(EndTurn)

export function isEndTurn(action?: GameAction): action is EndTurn {
    return action?.type === ActionType.EndTurn
}

export class HydratedEndTurn extends HydratableAction<typeof EndTurn> implements EndTurn {
    declare type: ActionType.EndTurn
    declare playerId: string

    constructor(data: EndTurn) {
        super(data, EndTurnValidator)
    }

    apply(state: HydratedNapoleonsTriumphGameState) {
        assert(state.attack === undefined, 'An attack is still being resolved')
        assert(state.turnPlayerId === this.playerId, 'It is not that player’s turn')
    }
}
