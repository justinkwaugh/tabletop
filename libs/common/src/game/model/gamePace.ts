import type { Game } from './game.js'
import { lastMoveAt } from './gameStall.js'
import { assertExists } from '../../util/assertions.js'
import { MILLISECONDS_PER_MINUTE } from '../../util/time.js'

export enum GamePace {
    Live = 'live',
    Fast = 'fast',
    SameDay = 'sameDay',
    Daily = 'daily',
    Relaxed = 'relaxed'
}

export type GamePacePreset = { pace: GamePace; minutes: number }

export const GAME_PACE_PRESETS: readonly GamePacePreset[] = [
    { pace: GamePace.Live, minutes: 15 },
    { pace: GamePace.Fast, minutes: 60 },
    { pace: GamePace.SameDay, minutes: 8 * 60 },
    { pace: GamePace.Daily, minutes: 24 * 60 },
    { pace: GamePace.Relaxed, minutes: 3 * 24 * 60 }
]

export const DEFAULT_PACE_MINUTES = gamePacePreset(GamePace.Daily).minutes

export function gamePacePreset(pace: GamePace): GamePacePreset {
    const preset = GAME_PACE_PRESETS.find((candidate) => candidate.pace === pace)
    assertExists(preset, `Unknown game pace ${pace}`)
    return preset
}

export function gamePaceMinutes(game: Pick<Game, 'paceMinutes'>): number {
    return game.paceMinutes ?? DEFAULT_PACE_MINUTES
}

export function snapPaceMinutes(minutes: number): number {
    const preset = GAME_PACE_PRESETS.find((candidate) => minutes <= candidate.minutes)
    assertExists(preset, `A pace of ${minutes} minutes is slower than every preset`)
    return preset.minutes
}

export function gamePaceOf(game: Pick<Game, 'paceMinutes'>): GamePacePreset {
    const minutes = gamePaceMinutes(game)
    const preset = GAME_PACE_PRESETS.find((candidate) => candidate.minutes === minutes)
    assertExists(preset, `A stored pace of ${minutes} minutes is not a preset`)
    return preset
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

export function longestTurnWait(game: TurnTiming, now: Date): number | undefined {
    const activePlayerIds = game.activePlayerIds ?? []
    if (activePlayerIds.length === 0) return undefined
    return Math.max(
        0,
        ...activePlayerIds.map(
            (playerId) => now.getTime() - turnStartedAt(game, playerId).getTime()
        )
    )
}

export function waitExceedsPace(
    game: Pick<Game, 'paceMinutes'>,
    waitMilliseconds: number
): boolean {
    return waitMilliseconds > gamePaceMinutes(game) * MILLISECONDS_PER_MINUTE
}
