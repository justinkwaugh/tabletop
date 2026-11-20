import { describe, expect, it } from 'vitest'
import { GameStatus } from './game.js'
import { SeatHandoverBlock, sameSeatAccounts, seatHandoverBlock } from './seatHandover.js'

describe('seatHandoverBlock', () => {
    const inProgress = { status: GameStatus.Started, hotseat: false }

    it('allows an ordinary game in progress', () => {
        expect(seatHandoverBlock(inProgress)).toBeUndefined()
    })

    it('names what blocks a handover', () => {
        expect(
            seatHandoverBlock({
                ...inProgress,
                tournament: { tournamentId: 't', stageId: 's', scheduleId: 'x', tableId: '1' }
            })
        ).toBe(SeatHandoverBlock.Tournament)
        expect(seatHandoverBlock({ ...inProgress, hotseat: true })).toBe(SeatHandoverBlock.Hotseat)
        expect(seatHandoverBlock({ ...inProgress, status: GameStatus.Finished })).toBe(
            SeatHandoverBlock.NotInProgress
        )
    })
})

describe('sameSeatAccounts', () => {
    const seats = [
        { id: 'p1', userId: 'alice' },
        { id: 'p2', userId: 'bob' },
        { id: 'p3', userId: undefined }
    ]

    it('ignores order', () => {
        expect(sameSeatAccounts(seats, seats.toReversed())).toBe(true)
    })

    it('sees a seat change hands', () => {
        expect(sameSeatAccounts(seats, [{ id: 'p1', userId: 'carol' }, ...seats.slice(1)])).toBe(
            false
        )
    })
})
