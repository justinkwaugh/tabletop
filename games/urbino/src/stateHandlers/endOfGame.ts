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

        if (gameState.concededByPlayerId) {
            gameState.result = GameResult.Win
            gameState.winningPlayerIds = gameState.players
                .filter((p) => p.playerId !== gameState.concededByPlayerId)
                .map((p) => p.playerId)
            gameState.activePlayerIds = []
            return
        }

        const districtScores = computeDistrictScores(gameState.board, gameState.monumentsVariant)
        for (const [playerId, points] of districtScores) {
            const player = gameState.getPlayerState(playerId)
            player.score += points
        }

        const rankedPlayers = [...gameState.players].sort((a, b) => b.score - a.score)
        const topScore = rankedPlayers[0].score
        const winners = rankedPlayers.filter((p) => p.score === topScore)

        gameState.result = GameResult.Win
        gameState.winningPlayerIds = winners.map((p) => p.playerId)
        gameState.activePlayerIds = []
    }

    onAction(
        _action: EndOfGameAction,
        _context: MachineContext<HydratedUrbinoGameState>
    ): MachineState {
        throw Error('No actions valid in EndOfGame state')
    }
}
