import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { DECADE, isFinalTurn } from '../model/turnCycle.js'
import { victoriousPlayerIds } from '../model/victory.js'

export type EndTurnMetadata = Type.Static<typeof EndTurnMetadata>
export const EndTurnMetadata = Type.Object({
    year: Type.Number(),
    victorIds: Type.Array(Type.String()),
    gameOver: Type.Boolean()
})

export type EndTurn = Type.Static<typeof EndTurn>
export const EndTurn = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.EndTurn),
            metadata: Type.Optional(EndTurnMetadata)
        })
    ])
)

export const EndTurnValidator = Compile(EndTurn)

export function isEndTurn(action?: GameAction): action is EndTurn {
    return action?.type === ActionType.EndTurn
}

export class HydratedEndTurn extends HydratableAction<typeof EndTurn> implements EndTurn {
    declare type: ActionType.EndTurn
    declare metadata?: EndTurnMetadata

    constructor(data: EndTurn) {
        super(data, EndTurnValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const year = state.year
        const victorIds = victoriousPlayerIds(state)
        const gameOver = victorIds.length > 0 || isFinalTurn(state)
        state.winningPlayerIds = victorIds
        if (!gameOver) {
            state.year += DECADE
        }
        this.metadata = { year, victorIds, gameOver }
    }
}
