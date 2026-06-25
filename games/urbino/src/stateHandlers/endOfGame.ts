import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedUrbinoGameState } from '../model/gameState.js'
import { computeDistrictScores } from '../logic/board.js'

type EndOfGameAction = HydratedAction

export class EndOfGameStateHandler
    implements MachineStateHandler<EndOfGameAction, HydratedUrbinoGameState>
{
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedUrbinoGameState>
    ): _action is EndOfGameAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedUrbinoGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedUrbinoGameState>) {
        const { gameState } = context

        const districtScores = computeDistrictScores(gameState.board, gameState.monumentsVariant)
        for (const [playerId, points] of districtScores) {
            const player = gameState.getPlayerState(playerId)
            player.score += points
        }

        gameState.result = GameResult.Win
        if (gameState.concededByPlayerId) {
            gameState.winningPlayerIds = gameState.players
                .filter((p) => p.playerId !== gameState.concededByPlayerId)
                .map((p) => p.playerId)
        } else {
            const rankedPlayers = [...gameState.players].sort((a, b) => b.score - a.score)
            const topScore = rankedPlayers[0].score
            gameState.winningPlayerIds = rankedPlayers
                .filter((p) => p.score === topScore)
                .map((p) => p.playerId)
        }
        gameState.activePlayerIds = []
    }

    onAction(
        _action: EndOfGameAction,
        _context: MachineContext<HydratedUrbinoGameState>
    ): MachineState {
        throw Error('No actions valid in EndOfGame state')
    }
}
