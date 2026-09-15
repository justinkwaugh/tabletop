import { assert, assertExists } from '../../util/assertions.js'
import type { GameState } from './gameState.js'

export enum GameResult {
    Abandoned = 'Abandoned',
    Draw = 'Draw',
    Win = 'Win'
}

export function validateGameResult(state: GameState): void {
    assertExists(state.result, 'Game has no final result')
    const winners = state.winningPlayerIds
    assert(new Set(winners).size === winners.length, 'Game winners must be distinct')
    assert(
        winners.every((id) => state.players.some((player) => player.playerId === id)),
        'Game winners must be players in the game'
    )
    if (state.result === GameResult.Win || state.result === GameResult.Draw) {
        assert(winners.length > 0, 'Finished game must declare winners')
    } else if (state.result === GameResult.Abandoned) {
        assert(winners.length === 0, 'Abandoned game cannot declare winners')
    }
}
