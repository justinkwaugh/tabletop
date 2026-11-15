import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, GameResult, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import { isLastRound } from '../rules/endOfRound.js'
import { PlayerMoney, moneyOf, richestPlayerIds } from '../rules/scoring.js'

export type EndGameMetadata = Type.Static<typeof EndGameMetadata>
export const EndGameMetadata = Type.Object({
    money: Type.Array(PlayerMoney),
    winningPlayerIds: Type.Array(Type.String())
})

export type EndGame = Type.Static<typeof EndGame>
export const EndGame = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.EndGame),
            metadata: Type.Optional(EndGameMetadata)
        })
    ])
)

export const EndGameValidator = Compile(EndGame)

export function isEndGame(action?: GameAction): action is EndGame {
    return action?.type === ActionType.EndGame
}

export class HydratedEndGame extends HydratableAction<typeof EndGame> implements EndGame {
    declare type: ActionType.EndGame
    declare metadata?: EndGameMetadata

    constructor(data: EndGame) {
        super(data, EndGameValidator)
    }

    // R-6.1, R-6.2: no reorder after round 6.
    apply(state: HydratedRideTheRailsGameState, _context?: MachineContext) {
        assert(HydratedEndGame.canEndGame(state), 'The game ends only after round 6 (R-6.1)')
        state.roundManager.endRound(state.actionCount)

        const winningPlayerIds = richestPlayerIds(state)
        state.winningPlayerIds = winningPlayerIds
        state.result = winningPlayerIds.length > 1 ? GameResult.Draw : GameResult.Win

        this.metadata = {
            money: moneyOf(state, state.turnManager.turnOrder),
            winningPlayerIds
        }
    }

    // R-6.1
    static canEndGame(state: HydratedRideTheRailsGameState): boolean {
        return isLastRound(state)
    }
}
