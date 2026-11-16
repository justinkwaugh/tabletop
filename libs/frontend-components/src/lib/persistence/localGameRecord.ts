import { GameStatus, type Game, type GameState } from '@tabletop/common'

/**
 * The record of a game kept in the browser, brought up to date with its state: who is to move,
 * and whether it has finished. A hosted game's record is kept this way by the server; a local
 * game has only this.
 */
export function localGameRecord(game: Game, state: GameState, now = new Date()): Game {
    const record: Game = {
        ...game,
        activePlayerIds: [...state.activePlayerIds],
        canContinue: state.canContinue
    }
    if (state.result) {
        return {
            ...record,
            status: GameStatus.Finished,
            finishedAt: game.finishedAt ?? now,
            result: state.result,
            winningPlayerIds: [...state.winningPlayerIds],
            everFinished: true
        }
    }
    if (game.status !== GameStatus.Finished) return record
    const reopened: Game = { ...record, status: GameStatus.Started, winningPlayerIds: [] }
    delete reopened.finishedAt
    delete reopened.result
    delete reopened.call
    delete reopened.finalScores
    return reopened
}
