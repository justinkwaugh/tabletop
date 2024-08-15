import { Type, type Static } from '@sinclair/typebox'
import { TurnManager } from '../components/turnManager.js'

export enum GameResult {
    Abandoned = 'Abandoned',
    Draw = 'Draw',
    Win = 'Win'
}

export type GameState = Static<typeof GameState>
export const GameState = Type.Object({
    id: Type.String(),
    gameId: Type.String(),
    activePlayerIds: Type.Array(Type.String()),
    actionCount: Type.Number(),
    machineState: Type.String(),
    turnManager: TurnManager,
    result: Type.Optional(Type.Enum(GameResult)),
    winningPlayerIds: Type.Array(Type.String())
})

export interface HydratedGameState extends GameState {
    dehydrate(): GameState
}
