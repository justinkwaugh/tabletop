import { describe, expect, it } from 'vitest'
import {
    knockoutBracket,
    knockoutPlacings,
    knockoutSeedPositions,
    knockoutSlots,
    knockoutTableName,
    type KnockoutBracket,
    type KnockoutResults
} from './tournamentKnockout.js'
import type { TournamentSchedule } from './tournamentSchedule.js'

type Schedule = Pick<TournamentSchedule, 'bracket' | 'tables'>

class Event {
    schedule: Schedule
    winners = new Map<string, string[]>()
    voided = new Set<string>()
    withdrawn = new Set<string>()

    constructor(entrants: string[]) {
        this.schedule = { bracket: { slots: knockoutSlots(entrants) }, tables: [] }
        this.add()
    }

    get results(): KnockoutResults {
        return { winners: this.winners, voided: this.voided, withdrawn: this.withdrawn }
    }

    bracket(): KnockoutBracket {
        return knockoutBracket(this.schedule, this.results)
    }

    /** Adds the due Tables, as the dispatcher does, and returns their ids. */
    add(): string[] {
        const due = this.bracket().due
        const start = this.schedule.tables.length
        this.schedule.tables.push(
            ...due.map((table, index) => ({
                id: String(start + index + 1),
                entrantIds: [...table.entrantIds],
                match: table.match
            }))
        )
        return due.map((_, index) => String(start + index + 1))
    }

    table(round: number, index: number, game: number) {
        const table = this.schedule.tables.findLast(
            (value) =>
                value.match?.round === round &&
                value.match.index === index &&
                value.match.game === game &&
                !this.voided.has(value.id)
        )
        if (!table) throw new Error(`No table for ${round}/${index}/${game}`)
        return table
    }

    win(round: number, index: number, game: number, ...winners: string[]) {
        this.winners.set(this.table(round, index, game).id, winners)
        return this.add()
    }
}

describe('knockout draw', () => {
    it('places seeds so the top two meet only in the final', () => {
        expect(knockoutSeedPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
    })

    it('gives the Byes to the first seeds, never against each other', () => {
        expect(knockoutSlots(['a', 'b', 'c', 'd', 'e'])).toEqual([
            'a',
            null,
            'd',
            'e',
            'b',
            null,
            'c',
            null
        ])
    })
})

describe('knockout matches', () => {
    it('start with one Game from each seat, swapped for the second', () => {
        const event = new Event(['a', 'b'])
        expect(event.schedule.tables).toEqual([
            { id: '1', entrantIds: ['a', 'b'], match: { round: 1, index: 0, game: 1 } },
            { id: '2', entrantIds: ['b', 'a'], match: { round: 1, index: 0, game: 2 } }
        ])
    })

    it('go to whoever wins both Games, with no Decider', () => {
        const event = new Event(['a', 'b'])
        expect(event.win(1, 0, 1, 'a')).toEqual([])
        expect(event.win(1, 0, 2, 'a')).toEqual([])
        const bracket = event.bracket()
        expect(bracket.championId).toBe('a')
        expect(bracket.finished).toBe(true)
        expect(bracket.rounds[0][0]).toMatchObject({ score: [2, 0], decidedBy: 'play' })
    })

    it('add a Decider only once a split Match has finished both Games', () => {
        const event = new Event(['a', 'b'])
        expect(event.win(1, 0, 1, 'a')).toEqual([])
        expect(event.win(1, 0, 2, 'b')).toEqual(['3'])
        expect(event.schedule.tables[2]).toEqual({
            id: '3',
            entrantIds: ['a', 'b'],
            match: { round: 1, index: 0, game: 3 }
        })
        event.win(1, 0, 3, 'b')
        expect(event.bracket()).toMatchObject({ championId: 'b', finished: true })
    })

    it('count a shared Game as half each, and replay a drawn Decider', () => {
        const event = new Event(['a', 'b'])
        event.win(1, 0, 1, 'a', 'b')
        event.win(1, 0, 2, 'a')
        expect(event.bracket().championId).toBe('a')

        const level = new Event(['a', 'b'])
        level.win(1, 0, 1, 'a', 'b')
        expect(level.win(1, 0, 2, 'a', 'b')).toEqual(['3'])
        expect(level.win(1, 0, 3, 'a', 'b')).toEqual(['4'])
        level.win(1, 0, 4, 'b')
        expect(level.bracket().rounds[0][0].score).toEqual([1.5, 2.5])
        expect(level.bracket().championId).toBe('b')
    })

    it('start a later Match as soon as both Matches feeding it are decided', () => {
        const event = new Event(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
        // a v h, d v e, b v g, c v f
        event.win(1, 0, 1, 'a')
        expect(event.win(1, 0, 2, 'a')).toEqual([])
        event.win(1, 1, 1, 'e')
        expect(event.win(1, 1, 2, 'e')).toHaveLength(2)
        expect(event.table(2, 0, 1).entrantIds).toEqual(['a', 'e'])
        expect(event.table(2, 0, 2).entrantIds).toEqual(['e', 'a'])
        expect(event.bracket().rounds[1][1].sides).toEqual([undefined, undefined])
    })

    it('advance an Entrant drawn against a Bye without playing', () => {
        const event = new Event(['a', 'b', 'c'])
        // a has a Bye; b v c
        expect(event.schedule.tables.map((table) => table.entrantIds)).toEqual([
            ['b', 'c'],
            ['c', 'b']
        ])
        expect(event.bracket().rounds[0][0]).toMatchObject({ winnerId: 'a', decidedBy: 'bye' })
        event.win(1, 1, 1, 'c')
        expect(event.win(1, 1, 2, 'c')).toHaveLength(2)
        expect(event.table(2, 0, 1).entrantIds).toEqual(['a', 'c'])
    })

    it('replay a Game whose Table was voided', () => {
        const event = new Event(['a', 'b'])
        event.voided.add(event.table(1, 0, 1).id)
        expect(event.add()).toEqual(['3'])
        expect(event.table(1, 0, 1)).toMatchObject({ id: '3', entrantIds: ['a', 'b'] })
    })
})

describe('withdrawals', () => {
    it('forfeit the Match to the opponent', () => {
        const event = new Event(['a', 'b'])
        event.win(1, 0, 1, 'a')
        event.withdrawn.add('a')
        expect(event.bracket()).toMatchObject({ championId: 'b', due: [] })
        expect(event.bracket().rounds[0][0].decidedBy).toBe('walkover')
    })

    it('of both Entrants send nobody on, and the next opponent walks over', () => {
        const event = new Event(['a', 'b', 'c', 'd'])
        // a v d, b v c
        event.withdrawn.add('a')
        event.withdrawn.add('d')
        expect(event.bracket().rounds[0][0].winnerId).toBeNull()
        event.win(1, 1, 1, 'b')
        expect(event.win(1, 1, 2, 'b')).toEqual([])
        expect(event.bracket()).toMatchObject({ championId: 'b', finished: true })
        expect(event.bracket().rounds[1][0].decidedBy).toBe('walkover')
    })

    it('of a winner waiting for their next opponent hand that Match to whoever arrives', () => {
        const event = new Event(['a', 'b', 'c', 'd'])
        event.win(1, 0, 1, 'a')
        event.win(1, 0, 2, 'a')
        event.withdrawn.add('a')
        expect(event.bracket().rounds[1][0].winnerId).toBeUndefined()
        event.win(1, 1, 1, 'c')
        expect(event.win(1, 1, 2, 'c')).toEqual([])
        expect(event.bracket().championId).toBe('c')
    })

    it('leave nobody to advance from a Bye whose Entrant was withdrawn', () => {
        const event = new Event(['a', 'b', 'c'])
        event.withdrawn.add('a')
        expect(event.bracket().rounds[0][0]).toMatchObject({
            winnerId: null,
            decidedBy: 'walkover'
        })
        event.win(1, 1, 1, 'b')
        expect(event.win(1, 1, 2, 'b')).toEqual([])
        expect(event.bracket().championId).toBe('b')
    })
})

describe('knockout placings', () => {
    it('rank by the round reached, each round’s losers sharing a place', () => {
        const event = new Event(['a', 'b', 'c', 'd', 'e'])
        // a Bye, d v e, b Bye, c Bye
        event.win(1, 1, 1, 'd')
        event.win(1, 1, 2, 'd')
        event.win(2, 0, 1, 'a')
        event.win(2, 0, 2, 'a')
        expect(knockoutPlacings(event.bracket(), ['a', 'b', 'c', 'd', 'e'])).toEqual([
            ['a'],
            ['b', 'c'],
            ['d'],
            ['e']
        ])
        event.win(2, 1, 1, 'c')
        event.win(2, 1, 2, 'c')
        event.win(3, 0, 1, 'c')
        event.win(3, 0, 2, 'c')
        expect(knockoutPlacings(event.bracket(), ['a', 'b', 'c', 'd', 'e'])).toEqual([
            ['c'],
            ['a'],
            ['b', 'd'],
            ['e']
        ])
    })
})

describe('knockout table names', () => {
    it('name the round, the Match and the Game', () => {
        expect(knockoutTableName({ round: 3, index: 0, game: 1 }, 3)).toBe('Final · Game 1')
        expect(knockoutTableName({ round: 2, index: 1, game: 3 }, 3)).toBe('Semi-final 2 · Decider')
        expect(knockoutTableName({ round: 1, index: 4, game: 4 }, 5)).toBe(
            'Round 1 · Match 5 · Decider 2'
        )
    })
})
