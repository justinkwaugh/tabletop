import { describe, expect, it } from 'vitest'
import { GameStatus, type Game } from '../game/model/game.js'
import { PlayerStatus } from '../game/model/player.js'
import {
    parseTimeDifferenceStartDate,
    sharesTimeDifference,
    timeDifferenceStartDateText,
    timeDifferenceUserIds,
    wholeHourOffset
} from './timeDifference.js'

const winter = new Date('2026-01-15T12:00:00Z')
const summer = new Date('2026-07-15T12:00:00Z')

describe('wholeHourOffset', () => {
    it('follows daylight saving', () => {
        expect(wholeHourOffset('Europe/London', winter)).toBe(0)
        expect(wholeHourOffset('Europe/London', summer)).toBe(1)
        expect(wholeHourOffset('America/Los_Angeles', winter)).toBe(-8)
        expect(wholeHourOffset('America/Los_Angeles', summer)).toBe(-7)
    })

    it('rounds half and quarter hours to whole hours, halves away from zero', () => {
        expect(wholeHourOffset('Asia/Kolkata', winter)).toBe(6)
        expect(wholeHourOffset('Asia/Kathmandu', winter)).toBe(6)
        expect(wholeHourOffset('America/St_Johns', winter)).toBe(-4)
        expect(wholeHourOffset('UTC', winter)).toBe(0)
    })

    it('gives nothing for a zone this runtime does not know', () => {
        expect(wholeHourOffset('Not/AZone', winter)).toBeUndefined()
    })
})

describe('sharesTimeDifference', () => {
    it('shares unless turned off', () => {
        expect(sharesTimeDifference(undefined)).toBe(true)
        expect(sharesTimeDifference({})).toBe(true)
        expect(sharesTimeDifference({ shareTimeDifference: true })).toBe(true)
        expect(sharesTimeDifference({ shareTimeDifference: false })).toBe(false)
    })
})

describe('timeDifferenceUserIds', () => {
    const players = ['a', 'b'].map((id) => ({
        id: `p-${id}`,
        userId: `u-${id}`,
        name: id,
        isHuman: true,
        status: PlayerStatus.Joined
    }))
    function game(fields: Partial<Game>): Game {
        return {
            id: 'g',
            typeId: 't',
            status: GameStatus.Started,
            isPublic: true,
            deleted: false,
            ownerId: 'owner',
            name: 'Game',
            players,
            config: {},
            hotseat: false,
            createdAt: winter,
            winningPlayerIds: [],
            activePlayerIds: ['p-a'],
            ...fields
        }
    }

    it('takes the owner of a game still filling its seats', () => {
        expect(timeDifferenceUserIds([game({ status: GameStatus.WaitingForPlayers })])).toEqual([
            'owner'
        ])
        expect(timeDifferenceUserIds([game({ status: GameStatus.WaitingToStart })])).toEqual([
            'owner'
        ])
    })

    it('takes the one player due to move in a game faster than daily', () => {
        expect(timeDifferenceUserIds([game({ paceMinutes: 60 })])).toEqual(['u-a'])
        expect(timeDifferenceUserIds([game({})])).toEqual([])
        expect(
            timeDifferenceUserIds([game({ paceMinutes: 60, activePlayerIds: ['p-a', 'p-b'] })])
        ).toEqual([])
    })

    it('skips hotseat and finished games, and lists each user once', () => {
        expect(
            timeDifferenceUserIds([
                game({ hotseat: true, status: GameStatus.WaitingForPlayers }),
                game({ status: GameStatus.Finished, paceMinutes: 60 }),
                game({ paceMinutes: 60 }),
                game({ paceMinutes: 15 })
            ])
        ).toEqual(['u-a'])
    })
})

describe('parseTimeDifferenceStartDate', () => {
    it('reads a configured date, treats an empty one as unset, and refuses a broken one', () => {
        expect(parseTimeDifferenceStartDate('2026-11-26T12:00:00Z')).toEqual(
            new Date('2026-11-26T12:00:00Z')
        )
        expect(parseTimeDifferenceStartDate('')).toBeUndefined()
        expect(parseTimeDifferenceStartDate(undefined)).toBeUndefined()
        expect(() => parseTimeDifferenceStartDate('soon')).toThrow('not a date')
    })
})

describe('timeDifferenceStartDateText', () => {
    it('gives the day in UTC, whatever the reader’s zone', () => {
        expect(timeDifferenceStartDateText(new Date('2026-12-04T23:30:00Z'), 'en-US')).toBe(
            'December 4, 2026'
        )
    })
})
