import { describe, expect, it } from 'vitest'
import {
    GamePace,
    gamePaceOf,
    longestTurnWait,
    snapPaceMinutes,
    turnStartsAfter,
    waitExceedsPace
} from './gamePace.js'

const now = new Date('2026-11-12T12:00:00Z')
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000)
const createdAt = minutesAgo(10_000)

describe('game pace', () => {
    it('reads a game with no pace as Daily', () => {
        expect(gamePaceOf({}).pace).toBe(GamePace.Daily)
        expect(gamePaceOf({ paceMinutes: 60 }).pace).toBe(GamePace.Fast)
    })

    it('stores a duration between presets as the preset it falls within', () => {
        expect(snapPaceMinutes(10)).toBe(15)
        expect(snapPaceMinutes(16)).toBe(60)
        expect(snapPaceMinutes(2 * 24 * 60)).toBe(3 * 24 * 60)
        expect(snapPaceMinutes(3 * 24 * 60)).toBe(3 * 24 * 60)
    })

    it('refuses to read a stored pace that is not a preset', () => {
        expect(() => gamePaceOf({ paceMinutes: 90 })).toThrow('not a preset')
    })
})

describe('turnStartsAfter', () => {
    it('starts the turn of every newly active player at the change', () => {
        const previous = {
            createdAt,
            activePlayerIds: ['a'],
            turnStartedAt: { a: minutesAgo(30) }
        }
        expect(turnStartsAfter(previous, ['b', 'c'], now)).toEqual({
            b: now,
            c: now
        })
    })

    it('keeps the start of a player who stays active', () => {
        const started = minutesAgo(30)
        const previous = { createdAt, activePlayerIds: ['a', 'b'], turnStartedAt: { a: started } }
        expect(turnStartsAfter(previous, ['a'], now)).toEqual({ a: started })
    })

    it('carries an unrecorded continuing turn from the last move', () => {
        const previous = { createdAt, activePlayerIds: ['a'], lastActionAt: minutesAgo(90) }
        expect(turnStartsAfter(previous, ['a'], now)).toEqual({ a: minutesAgo(90) })
    })

    it('starts every turn at the change for a new game, and clears when nobody is active', () => {
        expect(turnStartsAfter(undefined, ['a'], now)).toEqual({ a: now })
        expect(turnStartsAfter({ createdAt, activePlayerIds: ['a'] }, [], now)).toBeUndefined()
    })
})

describe('waiting on the active players', () => {
    it('measures the longest wait among the active players', () => {
        const game = {
            createdAt,
            activePlayerIds: ['a', 'b'],
            turnStartedAt: { a: minutesAgo(20), b: minutesAgo(50) }
        }
        expect(longestTurnWait(game, now)).toBe(50 * 60_000)
        expect(longestTurnWait({ createdAt, activePlayerIds: [] }, now)).toBeUndefined()
    })

    it('falls back to the last move for games recorded before turn starts', () => {
        const game = { createdAt, activePlayerIds: ['a'], lastActionAt: minutesAgo(45) }
        expect(longestTurnWait(game, now)).toBe(45 * 60_000)
    })

    it('exceeds the pace only once the wait is longer than it', () => {
        const minutes = (count: number) => count * 60_000
        expect(waitExceedsPace({ paceMinutes: 60 }, minutes(60))).toBe(false)
        expect(waitExceedsPace({ paceMinutes: 60 }, minutes(61))).toBe(true)
        expect(waitExceedsPace({ paceMinutes: 15 }, minutes(16))).toBe(true)
        expect(waitExceedsPace({}, minutes(23 * 60))).toBe(false)
        expect(waitExceedsPace({}, minutes(25 * 60))).toBe(true)
    })
})
