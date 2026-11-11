import * as Type from 'typebox'
import type { GameState } from '../model/gameState.js'

export const TiebreakRule = Type.Union([
    Type.Literal('pointsBehind'),
    Type.Literal('shareOfWinner')
])
export type TiebreakRule = Type.Static<typeof TiebreakRule>

export interface GameScoring<T extends GameState = GameState> {
    finalScores(state: T): Record<string, number>
    tiebreakRule?: TiebreakRule
}
