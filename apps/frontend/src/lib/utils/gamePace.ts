import { GamePace, gamePaceOf, lastMoveAt, waitExceedsPace, type Game } from '@tabletop/common'
import { m } from '$lib/paraglide/messages'

type PaceTexts = {
    name: () => string
    line: () => string
    summary: () => string
    pastLimit: () => string
}

const PACE_TEXTS: Record<GamePace, PaceTexts> = {
    [GamePace.Live]: {
        name: m.pace_live_name,
        line: m.pace_live_name,
        summary: m.pace_live_name,
        pastLimit: m.pace_live_past_limit
    },
    [GamePace.Fast]: {
        name: m.pace_fast_name,
        line: m.pace_fast_line,
        summary: m.pace_fast_summary,
        pastLimit: m.pace_fast_past_limit
    },
    [GamePace.Brisk]: {
        name: m.pace_brisk_name,
        line: m.pace_brisk_line,
        summary: m.pace_brisk_summary,
        pastLimit: m.pace_brisk_past_limit
    },
    [GamePace.Daily]: {
        name: m.pace_daily_name,
        line: m.pace_daily_line,
        summary: m.pace_daily_name,
        pastLimit: m.pace_daily_past_limit
    },
    [GamePace.Relaxed]: {
        name: m.pace_relaxed_name,
        line: m.pace_relaxed_line,
        summary: m.pace_relaxed_summary,
        pastLimit: m.pace_relaxed_past_limit
    }
}

export function paceTexts(pace: GamePace): PaceTexts {
    return PACE_TEXTS[pace]
}

export function lastMovePaceWarning(game: Game, now: Date): string | undefined {
    if (!waitExceedsPace(game, now.getTime() - lastMoveAt(game).getTime())) return undefined
    return paceTexts(gamePaceOf(game).pace).pastLimit()
}
