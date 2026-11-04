import { describe, expect, it } from 'vitest'
import { PlayerStatus, type Player } from '@tabletop/common'
import { matchContinuedPlayers } from './continuation.js'

// Who is who between a finished game and the game continued from it. Player ids are new in every
// game, so they are never compared: the previous game's ids here are `n1`…, this game's `m1`….

function seats(prefix: string, ...people: [name: string, userId?: string][]): Player[] {
    return people.map(([name, userId], index) => ({
        id: `${prefix}${index + 1}`,
        isHuman: true,
        ...(userId !== undefined ? { userId } : {}),
        name,
        status: PlayerStatus.Joined
    }))
}

describe('matchContinuedPlayers', () => {
    it('hosted: each account held once on each side matches, wherever it sits and whatever its name', () => {
        const previous = seats('n', ['Dana', 'u-dana'], ['Rhys', 'u-rhys'], ['Ann', 'u-ann'])
        const players = seats('m', ['Ann B.', 'u-ann'], ['Dana', 'u-dana'], ['Rhys', 'u-rhys'])
        expect(matchContinuedPlayers(previous, players)).toEqual({
            returning: { m1: 'n3', m2: 'n1', m3: 'n2' },
            newcomers: [],
            left: []
        })
    })

    it('hosted: a newcomer replacing a leaver is a newcomer; two accounts are never one person', () => {
        const previous = seats('n', ['Dana', 'u-dana'], ['Rhys', 'u-rhys'], ['Ann', 'u-ann'])
        const players = seats('m', ['Ann', 'u-ann'], ['Dana', 'u-dana'], ['Bea', 'u-bea'])
        expect(matchContinuedPlayers(previous, players)).toEqual({
            returning: { m1: 'n3', m2: 'n1' },
            newcomers: ['m3'],
            left: ['n2']
        })
    })

    it('hosted: a newcomer who shares a leaver’s name is still a newcomer', () => {
        const previous = seats('n', ['Dana', 'u-dana'], ['Sam', 'u-sam-1'])
        const players = seats('m', ['Dana', 'u-dana'], ['Sam', 'u-sam-2'])
        expect(matchContinuedPlayers(previous, players)).toEqual({
            returning: { m1: 'n1' },
            newcomers: ['m2'],
            left: ['n2']
        })
    })

    it('hotseat with no accounts: by name, then by place in the list', () => {
        const previous = seats('n', ['Dana'], ['Rhys'], ['Ann'])
        const players = seats('m', ['Ann'], ['Dana'], ['Rhys'])
        expect(matchContinuedPlayers(previous, players).returning).toEqual({
            m1: 'n3',
            m2: 'n1',
            m3: 'n2'
        })
    })

    it('local: every seat on the owner’s account, so the account matches no one alone; names do', () => {
        const previous = seats('n', ['Dana', 'owner'], ['Rhys', 'owner'], ['Ann', 'owner'])
        const players = seats('m', ['Rhys', 'owner'], ['Ann', 'owner'], ['Dana', 'owner'])
        expect(matchContinuedPlayers(previous, players)).toEqual({
            returning: { m1: 'n2', m2: 'n3', m3: 'n1' },
            newcomers: [],
            left: []
        })
    })

    it('a renamed hotseat seat is matched by its place among the seats still unmatched', () => {
        const previous = seats('n', ['Dana', 'owner'], ['Rhys', 'owner'], ['Ann', 'owner'])
        const players = seats('m', ['Dana', 'owner'], ['Rhys B.', 'owner'], ['Ann', 'owner'])
        expect(matchContinuedPlayers(previous, players).returning).toEqual({
            m1: 'n1',
            m2: 'n2',
            m3: 'n3'
        })
    })

    it('two seats with the same name match in list order', () => {
        const previous = seats('n', ['Sam', 'owner'], ['Dana', 'owner'], ['Sam', 'owner'])
        const players = seats('m', ['Sam', 'owner'], ['Sam', 'owner'], ['Dana', 'owner'])
        expect(matchContinuedPlayers(previous, players).returning).toEqual({
            m1: 'n1',
            m2: 'n3',
            m3: 'n2'
        })
    })

    it('a bigger table: the extra players are newcomers', () => {
        const previous = seats('n', ['Dana', 'u-dana'], ['Rhys', 'u-rhys'])
        const players = seats(
            'm',
            ['Rhys', 'u-rhys'],
            ['Bea', 'u-bea'],
            ['Dana', 'u-dana'],
            ['Eli', 'u-eli']
        )
        expect(matchContinuedPlayers(previous, players)).toEqual({
            returning: { m1: 'n2', m3: 'n1' },
            newcomers: ['m2', 'm4'],
            left: []
        })
    })

    it('a smaller table: the missing players have left', () => {
        const previous = seats(
            'n',
            ['Dana', 'owner'],
            ['Rhys', 'owner'],
            ['Ann', 'owner'],
            ['Bea', 'owner']
        )
        const players = seats('m', ['Bea', 'owner'], ['Dana', 'owner'])
        expect(matchContinuedPlayers(previous, players)).toEqual({
            returning: { m1: 'n4', m2: 'n1' },
            newcomers: [],
            left: ['n2', 'n3']
        })
    })

    it('never compares player ids: equal ids for different people do not match them', () => {
        const previous = seats('p', ['Dana', 'u-dana'], ['Rhys', 'u-rhys'])
        const players = seats('p', ['Rhys', 'u-rhys'], ['Dana', 'u-dana'])
        expect(matchContinuedPlayers(previous, players).returning).toEqual({ p1: 'p2', p2: 'p1' })
    })
})
