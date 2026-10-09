import { GameStatus, type Game, type GameAction, type GameState } from '@tabletop/common'

export function updatedGameRecord(game: Game, state: GameState, lastAction?: GameAction): Game {
    return {
        ...game,
        activePlayerIds: [...state.activePlayerIds],
        status: state.result ? GameStatus.Finished : GameStatus.Started,
        result: state.result,
        winningPlayerIds: [...state.winningPlayerIds],
        finishedAt: state.result ? (game.finishedAt ?? new Date()) : undefined,
        updatedAt: new Date(),
        lastActionAt: lastAction?.createdAt,
        lastActionPlayerId: lastAction?.playerId
    }
}
