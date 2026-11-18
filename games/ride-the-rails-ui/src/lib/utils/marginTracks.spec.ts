import { afterEach, describe, expect, it } from 'vitest'
import { flushSync } from 'svelte'
import {
    PassJourney,
    LOCOMOTIVES_PER_RAILROAD,
    PhaseName,
    RAILROAD_IDS,
    RAILROAD_INTRODUCTIONS,
    supplyOf,
    cityById,
    type HexId
} from '@tabletop/ride-the-rails'
import { buildState } from '@tabletop/ride-the-rails/testing'
import { disposeSessions, openSessionOn } from '$lib/testing/sessionHarness.js'
import {
    ordinal,
    railroadCards,
    romanRound,
    roundTickets,
    shownRoundNumber,
    ticketPaint
} from './marginTracks.js'
import { contrastRatio } from '$lib/testing/colourMetrics.js'
import { paletteNames, tokenValue } from '$lib/testing/paletteSource.js'

afterEach(() => {
    disposeSessions()
})

const NEW_YORK: HexId = cityById('city.usa.new-york').hexId
const PITTSBURGH: HexId = cityById('city.usa.pittsburgh').hexId
const CHICAGO: HexId = cityById('city.usa.chicago').hexId

describe('the railroad cards', () => {
    const state = buildState({
        playerCount: 4,
        round: 2,
        phase: PhaseName.Build,
        shares: {
            p1: { 'railroad.red': 2 },
            p3: { 'railroad.red': 1, 'railroad.orange': 1 },
            p4: { 'railroad.blue': 1 }
        },
        track: {
            [NEW_YORK]: ['railroad.red'],
            [PITTSBURGH]: ['railroad.red'],
            [CHICAGO]: ['railroad.orange']
        }
    })
    const strip = railroadCards(state)

    it('has one card per railroad available this round, in R-1.4 order', () => {
        expect(strip.map((entry) => entry.railroadId)).toEqual(RAILROAD_IDS.slice(0, 3))
    })

    it('shows the supply the rules count (R-1.1)', () => {
        for (const entry of strip) {
            expect(entry.supply).toBe(supplyOf(state, entry.railroadId))
        }
        expect(strip[0].supply).toBe(LOCOMOTIVES_PER_RAILROAD - 3 - 2)
    })

    it('lists the shareholders in turn order with their shares', () => {
        expect(strip[0].shareholders).toEqual([
            { playerId: 'p1', shares: 2 },
            { playerId: 'p3', shares: 1 }
        ])
        expect(strip[1].shareholders).toEqual([{ playerId: 'p4', shares: 1 }])
        expect(strip[2].shareholders).toEqual([{ playerId: 'p3', shares: 1 }])
    })

    it('shows only the railroads available in the round (R-1.4)', () => {
        const names = (round: number) =>
            railroadCards(buildState({ round }), round).map((entry) => entry.railroadId)
        expect(names(1)).toEqual(['railroad.red', 'railroad.blue'])
        expect(names(3)).toEqual([
            'railroad.red',
            'railroad.blue',
            'railroad.orange',
            'railroad.yellow'
        ])
        expect(names(4)).toContain('railroad.purple')
        expect(names(4)).not.toContain('railroad.black')
        expect(names(5)).toEqual([...RAILROAD_IDS])
    })

    it('shows the round it is given, as the end of a round steps ahead of the state', () => {
        const roundOne = buildState({ round: 1 })
        expect(railroadCards(roundOne, 2).map((entry) => entry.railroadId)).toEqual(
            RAILROAD_IDS.slice(0, 3)
        )
    })
})

describe('the round tickets', () => {
    const tickets = roundTickets('map.usa')

    it('name rounds I to VI (R-2.1)', () => {
        expect([1, 2, 3, 4, 5, 6].map(romanRound)).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI'])
        expect(tickets.map((ticket) => ticket.round)).toEqual([1, 2, 3, 4, 5, 6])
        expect(tickets.map((ticket) => ticket.numeral)).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI'])
    })

    it('carry the railroads each round makes available, in R-1.4 order (R-1.4)', () => {
        expect(tickets.map((ticket) => ticket.arrivals)).toEqual([
            ['railroad.red', 'railroad.blue'],
            ['railroad.orange'],
            ['railroad.yellow'],
            ['railroad.purple'],
            ['railroad.black'],
            []
        ])
    })

    it('take their arrivals from the map’s introductions, every railroad once', () => {
        const arrivals = tickets.flatMap((ticket) => ticket.arrivals)
        expect(arrivals).toEqual(
            RAILROAD_INTRODUCTIONS['map.usa'].map((introduction) => introduction.railroadId)
        )
    })

    it('fill each ticket with the colour its round adds, round I split Red and Blue', () => {
        expect(tickets.map((ticket) => ticket.paint?.background)).toEqual([
            'linear-gradient(90deg, var(--rtr-railroad-red) 0% 50%, var(--rtr-railroad-blue) 50% 100%)',
            'var(--rtr-railroad-orange)',
            'var(--rtr-railroad-yellow)',
            'var(--rtr-railroad-purple)',
            'var(--rtr-railroad-black)',
            undefined
        ])
    })

    it('write each numeral in its railroad’s ink, and round I’s light with a halo', () => {
        expect(tickets.map((ticket) => ticket.paint?.ink)).toEqual([
            'var(--rtr-ink-light)',
            'var(--rtr-railroad-orange-ink)',
            'var(--rtr-railroad-yellow-ink)',
            'var(--rtr-railroad-purple-ink)',
            'var(--rtr-railroad-black-ink)',
            undefined
        ])
        expect(tickets.map((ticket) => ticket.paint?.halo)).toEqual([
            true,
            false,
            false,
            false,
            false,
            undefined
        ])
    })

    it.each(paletteNames())(
        'reads round I’s light numeral on Red and on Blue in the %s palette',
        (palette) => {
            for (const fill of ['rtr-railroad-red', 'rtr-railroad-blue']) {
                expect(
                    contrastRatio(tokenValue(palette, 'rtr-ink-light'), tokenValue(palette, fill))
                ).toBeGreaterThanOrEqual(4.5)
            }
        }
    )

    it('splits any round that adds more than one railroad the same way', () => {
        expect(ticketPaint(['railroad.orange', 'railroad.yellow'])).toEqual({
            background:
                'linear-gradient(90deg, var(--rtr-railroad-orange) 0% 50%, var(--rtr-railroad-yellow) 50% 100%)',
            ink: 'var(--rtr-ink-light)',
            halo: true
        })
        expect(ticketPaint([])).toBeUndefined()
    })

    it('name each round and the railroads it makes available', () => {
        expect(tickets.map((ticket) => ticket.label)).toEqual([
            'Round 1, Red and Blue arrive',
            'Round 2, Orange arrives',
            'Round 3, Yellow arrives',
            'Round 4, Purple arrives',
            'Round 5, Black arrives',
            'Round 6'
        ])
    })
})

describe('the tracks once the game ends', () => {
    it('keep round 6 on show with every railroad available (R-6.1, R-1.4)', async () => {
        const session = await openSessionOn(
            buildState({ playerCount: 3, round: 6, phase: PhaseName.Ride })
        )
        // R-3.3.1: the first seat's pass sets off the others', and the game ends in its cascade.
        await session.applyAction(session.createPlayerAction(PassJourney, {}))
        await session.waitForVisibleTransitionSettled()
        flushSync()
        const state = session.gameState
        expect(state.result).toBeDefined()
        expect(state.roundManager.currentRound).toBeUndefined()
        expect(shownRoundNumber(state)).toBe(6)
        expect(railroadCards(state).map((entry) => entry.railroadId)).toEqual([...RAILROAD_IDS])
    })
})

describe('a seat’s place', () => {
    it('names each place in turn order', () => {
        expect([1, 2, 3, 4, 5].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '5th'])
    })
})
