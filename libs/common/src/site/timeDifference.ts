import * as Type from 'typebox'
import { assert } from '../util/assertions.js'
import { DateType } from '../util/typebox.js'
import { GameStatus, soleActivePlayer, type Game } from '../game/model/game.js'
import { DEFAULT_PACE_MINUTES, gamePaceMinutes } from '../game/model/gamePace.js'
import type { UserPreferences } from './user.js'

export type TimeOffsets = Type.Static<typeof TimeOffsets>
export const TimeOffsets = Type.Record(Type.String(), Type.Union([Type.Integer(), Type.Null()]))

export function sharesTimeDifference(
    preferences: Pick<UserPreferences, 'shareTimeDifference'> | undefined
): boolean {
    return preferences?.shareTimeDifference !== false
}

// Half hours round away from zero, so a half-hour zone never reads as a more precise place.
export function wholeHourOffset(timeZone: string, at: Date): number | undefined {
    const minutes = utcOffsetMinutes(timeZone, at)
    if (minutes === undefined) return undefined
    const hours = Math.round(Math.abs(minutes) / 60)
    return minutes < 0 ? -hours : hours
}

function utcOffsetMinutes(timeZone: string, at: Date): number | undefined {
    let name: string | undefined
    try {
        name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
            .formatToParts(at)
            .find((part) => part.type === 'timeZoneName')?.value
    } catch {
        // Zones come from browsers, whose time zone data can be newer than this runtime's.
        return undefined
    }
    if (name === 'GMT') return 0
    const match = name?.match(/^GMT([+-])(\d{2}):(\d{2})$/)
    if (!match) return undefined
    const minutes = Number(match[2]) * 60 + Number(match[3])
    return match[1] === '-' ? -minutes : minutes
}

// Deployment configuration: a malformed date fails loudly rather than never showing anything.
export function parseTimeDifferenceStartDate(value: string | undefined): Date | undefined {
    if (!value) return undefined
    const date = new Date(value)
    assert(!isNaN(date.getTime()), `${value} is not a date, such as 2026-11-26T12:00:00Z`)
    return date
}

// In UTC, as an email cannot know its reader's time zone and the site must say the same day.
export function timeDifferenceStartDateText(startsAt: Date, locale: string): string {
    return startsAt.toLocaleDateString(locale, { dateStyle: 'long', timeZone: 'UTC' })
}

export function isFasterThanDaily(game: Pick<Game, 'paceMinutes'>): boolean {
    return gamePaceMinutes(game) < DEFAULT_PACE_MINUTES
}

export function timeDifferenceUserIds(games: readonly Game[]): string[] {
    return [...new Set(games.flatMap(gameTimeDifferenceUserIds))]
}

export function gameTimeDifferenceUserIds(game: Game): string[] {
    if (game.hotseat) return []
    if (game.status === GameStatus.WaitingForPlayers || game.status === GameStatus.WaitingToStart)
        return [game.ownerId]
    if (game.status !== GameStatus.Started || !isFasterThanDaily(game)) return []
    const userId = soleActivePlayer(game)?.userId
    return userId ? [userId] : []
}

export type TimeDifferenceNoticeStatus = Type.Static<typeof TimeDifferenceNoticeStatus>
export const TimeDifferenceNoticeStatus = Type.Object({
    startsAt: Type.Optional(DateType()),
    queuedAt: Type.Optional(DateType())
})

export type TimeDifferenceNoticeQueueing = Type.Static<typeof TimeDifferenceNoticeQueueing>
export const TimeDifferenceNoticeQueueing = Type.Union([
    Type.Object({
        outcome: Type.Literal('queued'),
        queued: Type.Integer(),
        startsAt: DateType()
    }),
    Type.Object({ outcome: Type.Literal('alreadyQueued'), queuedAt: DateType() })
])
