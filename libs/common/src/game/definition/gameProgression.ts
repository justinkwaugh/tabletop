import { Compile } from 'typebox/compile'
import type { GameState } from '../model/gameState.js'
import { GameProgress } from '../model/gameProgress.js'
import type { GameRuntime } from './gameDefinition.js'

// Called with host state, so it must report public information only.
export interface GameProgression<T extends GameState = GameState> {
    progress(state: T): GameProgress
}

const GameProgressValidator = Compile(GameProgress)

// Game Progress is a display aid: a failing or invalid report leaves it unset rather than
// failing the move that produced the state.
export function reportGameProgress<T extends GameState>(
    runtime: Pick<GameRuntime<T>, 'progression'>,
    state: T
): GameProgress | undefined {
    const progression = runtime.progression
    if (!progression) return undefined
    try {
        const progress = progression.progress(state)
        const reported = {
            ...progress,
            fraction: Math.round(Math.min(1, Math.max(0, progress.fraction)) * 1000) / 1000
        }
        if (GameProgressValidator.Check(reported)) return reported
        console.error('Invalid Game Progress', state.gameId, progress)
    } catch (error) {
        console.error('Game Progress failed', state.gameId, error)
    }
    return undefined
}
