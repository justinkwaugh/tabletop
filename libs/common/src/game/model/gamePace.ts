import type { Game } from './game.js'
import { lastMoveAt } from './gameStall.js'
import { assertExists } from '../../util/assertions.js'
import { MILLISECONDS_PER_MINUTE } from '../../util/time.js'

export enum GamePace {
    Live = 'live',
    Fast = 'fast',
    Brisk = 'brisk',
    Daily = 'daily',
    Relaxed = 'relaxed'
}

export type GamePacePreset = { pace: GamePace; minutes: number }

export const GAME_PACE_PRESETS: readonly GamePacePreset[] = [
    { pace: GamePace.Live, minutes: 15 },
    { pace: GamePace.Fast, minutes: 60 },
    { pace: GamePace.Brisk, minutes: 4 * 60 },
    { pace: GamePace.Daily, minutes: 24 * 60 },
    { pace: GamePace.Relaxed, minutes: 3 * 24 * 60 }
]

export const DEFAULT_PACE_MINUTES = gamePacePreset(GamePace.Daily).minutes

// Brisk replaced the 8 hour Same day pace; games stored at 8 hours are Brisk games.
const FORMER_SAME_DAY_MINUTES = 8 * 60

export function gamePacePreset(pace: GamePace): GamePacePreset {
    const preset = GAME_PACE_PRESETS.find((candidate) => candidate.pace === pace)
    assertExists(preset, `Unknown game pace ${pace}`)
    return preset
}

// Presets can change while games keep their stored minutes, so any duration must resolve.
function presetForMinutes(minutes: number): GamePacePreset {
    if (minutes === FORMER_SAME_DAY_MINUTES) return gamePacePreset(GamePace.Brisk)
    return (
        GAME_PACE_PRESETS.find((candidate) => minutes <= candidate.minutes) ??
        gamePacePreset(GamePace.Relaxed)
    )
}

export function snapPaceMinutes(minutes: number): number {
    return presetForMinutes(minutes).minutes
}

export function gamePaceOf(game: Pick<Game, 'paceMinutes'>): GamePacePreset {
    return presetForMinutes(game.paceMinutes ?? DEFAULT_PACE_MINUTES)
}

export function gamePaceMinutes(game: Pick<Game, 'paceMinutes'>): number {
    return gamePaceOf(game).minutes
}

type TurnTiming = Pick<
    Game,
    'activePlayerIds' | 'turnStartedAt' | 'lastActionAt' | 'startedAt' | 'createdAt'
>

export function turnStartedAt(game: TurnTiming, playerId: string): Date {
    return game.turnStartedAt?.[playerId] ?? lastMoveAt(game)
}

export function turnStartsAfter(
    previous: TurnTiming | undefined,
    activePlayerIds: string[],
    at: Date
): Record<string, Date> | undefined {
    if (activePlayerIds.length === 0) return undefined
    const continuing = new Set(previous?.activePlayerIds ?? [])
    return Object.fromEntries(
        activePlayerIds.map((playerId) => [
            playerId,
            previous && continuing.has(playerId) ? turnStartedAt(previous, playerId) : at
        ])
    )
}

export function waitExceedsPace(
    game: Pick<Game, 'paceMinutes'>,
    waitMilliseconds: number
): boolean {
    return waitMilliseconds > gamePaceMinutes(game) * MILLISECONDS_PER_MINUTE
}
